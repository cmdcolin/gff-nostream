/**
 * Unescape a string value used in a GFF3 attribute.
 *
 * @param stringVal - Escaped GFF3 string value
 * @returns An unescaped string value
 */
export function unescape(stringVal: string): string {
  return stringVal.replaceAll(/%([0-9A-Fa-f]{2})/g, (_match, seq) =>
    String.fromCharCode(parseInt(seq, 16)),
  )
}
/**
 * Parse the 9th column (attributes) of a GFF3 feature line.
 *
 * @param attrString - String of GFF3 9th column
 * @returns Parsed attributes
 */
export function parseAttributes(attrString: string): GFF3Attributes {
  if (!attrString.length || attrString === '.') {
    return {}
  }

  const attrs: GFF3Attributes = {}

  attrString
    .replace(/\r?\n$/, '')
    .split(';')
    .forEach(a => {
      const nv = a.split('=', 2)
      if (!nv[1]?.length) {
        return
      }

      nv[0] = nv[0].trim()
      let arec = attrs[nv[0].trim()]
      if (!arec) {
        arec = []
        attrs[nv[0]] = arec
      }

      arec.push(
        ...nv[1]
          .split(',')
          .map(s => s.trim())
          .map(unescape),
      )
    })
  return attrs
}

/**
 * Parse a GFF3 feature line
 *
 * @param line - GFF3 feature line
 * @returns The parsed feature
 */
export function parseFeature(line: string): GFF3FeatureLine {
  // split the line into columns and replace '.' with undefined in each column
  const f = line.split('\t').map(a => (a === '.' || a === '' ? undefined : a))

  // unescape only the ref, source, and type columns
  const parsed: GFF3FeatureLine = {
    seq_id: f[0] && unescape(f[0]),
    source: f[1] && unescape(f[1]),
    type: f[2] && unescape(f[2]),
    start: f[3] === undefined ? undefined : parseInt(f[3], 10),
    end: f[4] === undefined ? undefined : parseInt(f[4], 10),
    score: f[5] === undefined ? undefined : parseFloat(f[5]),
    strand: f[6],
    phase: f[7],
    attributes: f[8] === undefined ? undefined : parseAttributes(f[8]),
  }
  return parsed
}

/**
 * Parse a GFF3 directive line.
 *
 * @param line - GFF3 directive line
 * @returns The parsed directive
 */
export function parseDirective(
  line: string,
):
  | GFF3Directive
  | GFF3SequenceRegionDirective
  | GFF3GenomeBuildDirective
  | undefined {
  const match = /^\s*##\s*(\S+)\s*(.*)/.exec(line)
  if (!match) {
    return undefined
  }

  const [, name] = match
  let [, , contents] = match

  const parsed: GFF3Directive = { directive: name }
  if (contents.length) {
    contents = contents.replace(/\r?\n$/, '')
    parsed.value = contents
  }

  // do a little additional parsing for sequence-region and genome-build directives
  if (name === 'sequence-region') {
    const c = contents.split(/\s+/, 3)
    return {
      ...parsed,
      seq_id: c[0],
      start: c[1]?.replaceAll(/\D/g, ''),
      end: c[2]?.replaceAll(/\D/g, ''),
    } as GFF3SequenceRegionDirective
  } else if (name === 'genome-build') {
    const [source, buildName] = contents.split(/\s+/, 2)
    return {
      ...parsed,
      source,
      buildName,
    } as GFF3GenomeBuildDirective
  }

  return parsed
}

/** A record of GFF3 attribute identifiers and the values of those identifiers */
export type GFF3Attributes = Record<string, string[] | undefined>

/** A representation of a single line of a GFF3 file */
export interface GFF3FeatureLine {
  /** The ID of the landmark used to establish the coordinate system for the current feature */
  seq_id: string | undefined
  /** A free text qualifier intended to describe the algorithm or operating procedure that generated this feature */
  source: string | undefined
  /** The type of the feature */
  type: string | undefined
  /** The start coordinates of the feature */
  start: number | undefined
  /** The end coordinates of the feature */
  end: number | undefined
  /** The score of the feature */
  score: number | undefined
  /** The strand of the feature */
  strand: string | undefined
  /** For features of type "CDS", the phase indicates where the next codon begins relative to the 5' end of the current CDS feature */
  phase: string | undefined
  /** Feature attributes */
  attributes: GFF3Attributes | undefined
}

/**
 * A GFF3 Feature line that includes references to other features defined in
 * their "Parent" or "Derives_from" attributes
 */
export interface GFF3FeatureLineWithRefs extends GFF3FeatureLine {
  /** An array of child features */
  child_features: GFF3Feature[]
  /** An array of features derived from this feature */
  derived_features: GFF3Feature[]
}

/**
 * A GFF3 feature, which may include multiple individual feature lines
 */
export type GFF3Feature = GFF3FeatureLineWithRefs[]

/** A GFF3 directive */
export interface GFF3Directive {
  /** The name of the directive */
  directive: string
  /** The string value of the directive */
  value?: string
}

/** A GFF3 sequence-region directive */
export interface GFF3SequenceRegionDirective extends GFF3Directive {
  /** The string value of the directive */
  value: string
  /** The sequence ID parsed from the directive */
  seq_id: string
  /** The sequence start parsed from the directive */
  start: string
  /** The sequence end parsed from the directive */
  end: string
}

/** A GFF3 genome-build directive */
export interface GFF3GenomeBuildDirective extends GFF3Directive {
  /** The string value of the directive */
  value: string
  /** The genome build source parsed from the directive */
  source: string
  /** The genome build name parsed from the directive */
  buildName: string
}

/** A GFF3 comment */
export interface GFF3Comment {
  /** The text of the comment */
  comment: string
}

/** A GFF3 FASTA single sequence */
export interface GFF3Sequence {
  /** The ID of the sequence */
  id: string
  /** The description of the sequence */
  description?: string
  /** The sequence */
  sequence: string
}

export type GFF3Item = GFF3Feature | GFF3Directive | GFF3Comment | GFF3Sequence
