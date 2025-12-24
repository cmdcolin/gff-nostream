import * as GFF3 from './util.ts'

const featureLineRegex = /^\s*[^#\s>]/
const commentOrDirectiveRegex = /^\s*(#+)(.*)/
const blankLineRegex = /^\s*$/
const fastaStartRegex = /^\s*>/
const lineEndingRegex = /\r?\n?$/g

interface ParserArgs {
  featureCallback?(feature: GFF3.GFF3Feature): void
  endCallback?(): void
  commentCallback?(comment: GFF3.GFF3Comment): void
  errorCallback?(error: string): void
  directiveCallback?(directive: GFF3.GFF3Directive): void
  bufferSize?: number
  disableDerivesFromReferences?: boolean
}

interface References {
  Parent: GFF3.GFF3Feature[]
  Derives_from: GFF3.GFF3Feature[]
}

export default class Parser {
  featureCallback: (feature: GFF3.GFF3Feature) => void
  endCallback: () => void
  commentCallback: (comment: GFF3.GFF3Comment) => void
  errorCallback: (error: string) => void
  disableDerivesFromReferences: boolean
  directiveCallback: (directive: GFF3.GFF3Directive) => void
  bufferSize: number
  eof = false
  lineNumber = 0
  // features that we have to keep on hand for now because they
  // might be referenced by something else
  private _underConstructionTopLevel: GFF3.GFF3Feature[] = []
  // index of the above by ID
  private _underConstructionById: Record<string, GFF3.GFF3Feature | undefined> =
    {}
  private _completedReferences: Record<
    string,
    Record<string, boolean | undefined> | undefined
  > = {}
  // features that reference something we have not seen yet
  // structured as:
  // {  'some_id' : {
  //     'Parent' : [ orphans that have a Parent attr referencing it ],
  //     'Derives_from' : [ orphans that have a Derives_from attr referencing it ],
  //    }
  // }
  private _underConstructionOrphans: Record<string, References | undefined> = {}

  constructor(args: ParserArgs) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const nullFunc = () => {}

    this.featureCallback = args.featureCallback || nullFunc
    this.endCallback = args.endCallback || nullFunc
    this.commentCallback = args.commentCallback || nullFunc
    this.errorCallback = args.errorCallback || nullFunc
    this.directiveCallback = args.directiveCallback || nullFunc
    this.disableDerivesFromReferences =
      args.disableDerivesFromReferences || false

    // number of lines to buffer
    this.bufferSize = args.bufferSize === undefined ? Infinity : args.bufferSize
  }

  addLine(line: string): void {
    if (this.eof) {
      return
    }

    this.lineNumber += 1

    if (featureLineRegex.test(line)) {
      // feature line, most common case
      this._bufferLine(line)
      return
    }

    const match = commentOrDirectiveRegex.exec(line)
    if (match) {
      // directive or comment
      const [, hashsigns] = match
      let [, , contents] = match

      if (hashsigns!.length === 3) {
        // sync directive, all forward-references are resolved.
        this._emitAllUnderConstructionFeatures()
      } else if (hashsigns!.length === 2) {
        const directive = GFF3.parseDirective(line)
        if (directive) {
          if (directive.directive === 'FASTA') {
            this._emitAllUnderConstructionFeatures()
            this.eof = true
          } else {
            this._emitItem(directive)
          }
        }
      } else {
        this._emitItem({ comment: contents!.trimStart() })
      }
    } else if (blankLineRegex.test(line)) {
      // blank line, do nothing
    } else if (fastaStartRegex.test(line)) {
      // implicit beginning of a FASTA section, stop parsing
      this._emitAllUnderConstructionFeatures()
      this.eof = true
    } else {
      // it's a parse error
      const errLine = line.replaceAll(lineEndingRegex, '')
      throw new Error(`GFF3 parse error.  Cannot parse '${errLine}'.`)
    }
  }

  addParsedFeatureLine(featureLine: GFF3.GFF3FeatureLine): void {
    if (this.eof) {
      return
    }
    this.lineNumber += 1
    this._bufferParsedLine(featureLine)
  }

  finish(): void {
    this._emitAllUnderConstructionFeatures()
    this.endCallback()
  }

  private _emitItem(
    i: GFF3.GFF3Feature | GFF3.GFF3Directive | GFF3.GFF3Comment,
  ) {
    if (Array.isArray(i)) {
      this.featureCallback(i)
    } else if ('directive' in i) {
      this.directiveCallback(i)
    } else if ('comment' in i) {
      this.commentCallback(i)
    }
  }

  private _enforceBufferSizeLimit(additionalItemCount = 0) {
    const _unbufferItem = (item?: GFF3.GFF3Feature) => {
      if (item && Array.isArray(item) && item[0].attributes?.ID?.[0]) {
        const ids = item[0].attributes.ID
        ids.forEach(id => {
          delete this._underConstructionById[id]
          delete this._completedReferences[id]
        })
        item.forEach(i => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (i.child_features) {
            i.child_features.forEach(c => {
              _unbufferItem(c)
            })
          }
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (i.derived_features) {
            i.derived_features.forEach(d => {
              _unbufferItem(d)
            })
          }
        })
      }
    }

    while (
      this._underConstructionTopLevel.length + additionalItemCount >
      this.bufferSize
    ) {
      const item = this._underConstructionTopLevel.shift()
      if (item) {
        this._emitItem(item)
        _unbufferItem(item)
      }
    }
  }

  /**
   * return all under-construction features, called when we know
   * there will be no additional data to attach to them
   */
  private _emitAllUnderConstructionFeatures() {
    this._underConstructionTopLevel.forEach(this._emitItem.bind(this))

    this._underConstructionTopLevel = []
    this._underConstructionById = {}
    this._completedReferences = {}

    // if we have any orphans hanging around still, this is a
    // problem. die with a parse error
    const orphanKeys = Object.keys(this._underConstructionOrphans)
    if (orphanKeys.length) {
      throw new Error(
        `some features reference other features that do not exist in the file (or in the same '###' scope). ${orphanKeys.join(',')}`,
      )
    }
  }

  private _bufferLine(line: string) {
    this._bufferParsedLine(GFF3.parseFeature(line))
  }

  private _bufferParsedLine(rawFeatureLine: GFF3.GFF3FeatureLine) {
    const featureLine = rawFeatureLine as GFF3.GFF3FeatureLineWithRefs
    featureLine.child_features = []
    featureLine.derived_features = []

    const ids = featureLine.attributes?.ID || []
    const parents = featureLine.attributes?.Parent || []
    const derives = this.disableDerivesFromReferences
      ? []
      : featureLine.attributes?.Derives_from || []

    if (!ids.length && !parents.length && !derives.length) {
      this._emitItem([featureLine])
      return
    }

    let feature: GFF3.GFF3Feature | undefined = undefined
    ids.forEach(id => {
      const existing = this._underConstructionById[id]
      if (existing) {
        if (existing[existing.length - 1].type !== featureLine.type) {
          this._parseError(
            `multi-line feature "${id}" has inconsistent types: "${
              featureLine.type
            }", "${existing[existing.length - 1].type}"`,
          )
        }
        existing.push(featureLine)
        feature = existing
      } else {
        feature = [featureLine]

        this._enforceBufferSizeLimit(1)
        if (!parents.length && !derives.length) {
          this._underConstructionTopLevel.push(feature)
        }
        this._underConstructionById[id] = feature

        this._resolveReferencesTo(feature, id)
      }
    })

    this._resolveReferencesFrom(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      feature || [featureLine],
      { Parent: parents, Derives_from: derives },
      ids,
    )
  }

  private _resolveReferencesTo(feature: GFF3.GFF3Feature, id: string) {
    const references = this._underConstructionOrphans[id]
    if (!references) {
      return
    }
    for (const loc of feature) {
      loc.child_features.push(...references.Parent)
      loc.derived_features.push(...references.Derives_from)
    }
    delete this._underConstructionOrphans[id]
  }

  private _parseError(message: string) {
    this.eof = true
    this.errorCallback(`${this.lineNumber}: ${message}`)
  }

  private _resolveReferencesFrom(
    feature: GFF3.GFF3Feature,
    references: { Parent: string[]; Derives_from: string[] },
    ids: string[],
  ) {
    for (const toId of references.Parent) {
      const otherFeature = this._underConstructionById[toId]
      if (otherFeature) {
        let dominated = false
        for (const id of ids) {
          const domKey = `Parent,${toId}`
          const rec =
            this._completedReferences[id] ||
            (this._completedReferences[id] = {})
          if (rec[domKey]) {
            dominated = true
          }
          rec[domKey] = true
        }
        if (!dominated) {
          for (const location of otherFeature) {
            location.child_features.push(feature)
          }
        }
      } else {
        let ref = this._underConstructionOrphans[toId]
        if (!ref) {
          ref = { Parent: [], Derives_from: [] }
          this._underConstructionOrphans[toId] = ref
        }
        ref.Parent.push(feature)
      }
    }

    for (const toId of references.Derives_from) {
      const otherFeature = this._underConstructionById[toId]
      if (otherFeature) {
        let dominated = false
        for (const id of ids) {
          const domKey = `Derives_from,${toId}`
          const rec =
            this._completedReferences[id] ||
            (this._completedReferences[id] = {})
          if (rec[domKey]) {
            dominated = true
          }
          rec[domKey] = true
        }
        if (!dominated) {
          for (const location of otherFeature) {
            location.derived_features.push(feature)
          }
        }
      } else {
        let ref = this._underConstructionOrphans[toId]
        if (!ref) {
          ref = { Parent: [], Derives_from: [] }
          this._underConstructionOrphans[toId] = ref
        }
        ref.Derives_from.push(feature)
      }
    }
  }
}
