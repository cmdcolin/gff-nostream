// Fast, low-level functions for parsing and formatting GFF3.
// JavaScript port of Robert Buels's Bio::GFF3::LowLevel Perl module.

const escapeRegex = /%([0-9A-Fa-f]{2})/g
const directiveRegex = /^\s*##\s*(\S+)\s*(.*)/
const lineEndRegex = /\r?\n$/
const whitespaceRegex = /\s+/
const nonDigitRegex = /\D/g
// eslint-disable-next-line no-control-regex
const attrEscapeRegex = /[\n;\r\t=%&,\u0000-\u001f\u007f-\u00ff]/g
// eslint-disable-next-line no-control-regex
const columnEscapeRegex = /[\n\r\t%\u0000-\u001f\u007f-\u00ff]/g

/**
 * Unescape a string value used in a GFF3 attribute.
 *
 * @param stringVal - Escaped GFF3 string value
 * @returns An unescaped string value
 */

export function unescape(stringVal: string): string {
  if (!stringVal.includes('%')) {
    return stringVal
  }
  return stringVal.replaceAll(escapeRegex, (_match, seq) =>
    String.fromCharCode(parseInt(seq, 16)),
  )
}

function _escape(regex: RegExp, s: string | number) {
  return String(s).replace(regex, ch => {
    const hex = ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')
    return `%${hex}`
  })
}

/**
 * Escape a value for use in a GFF3 attribute value.
 *
 * @param rawVal - Raw GFF3 attribute value
 * @returns An escaped string value
 */
export function escape(rawVal: string | number): string {
  return _escape(attrEscapeRegex, rawVal)
}

/**
 * Escape a value for use in a GFF3 column value.
 *
 * @param rawVal - Raw GFF3 column value
 * @returns An escaped column value
 */
export function escapeColumn(rawVal: string | number): string {
  return _escape(columnEscapeRegex, rawVal)
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

  let str = attrString
  if (str.endsWith('\n')) {
    str = str.slice(0, str.endsWith('\r\n') ? -2 : -1)
  }

  for (const a of str.split(';')) {
    const eqIdx = a.indexOf('=')
    if (eqIdx === -1) {
      continue
    }
    const value = a.slice(eqIdx + 1)
    if (!value.length) {
      continue
    }

    const tag = a.slice(0, eqIdx).trim()
    let arec = attrs[tag]
    if (!arec) {
      arec = []
      attrs[tag] = arec
    }

    for (const s of value.split(',')) {
      arec.push(unescape(s.trim()))
    }
  }
  return attrs
}

/**
 * Parse a GFF3 feature line
 *
 * @param line - GFF3 feature line
 * @returns The parsed feature
 */
export function parseFeature(line: string): GFF3FeatureLine {
  return parseFieldsArray(line.split('\t'))
}

/**
 * Parse a GFF3 feature from a pre-split fields array
 *
 * @param f - Array of 9 GFF3 column values (use null or '.' for empty values)
 * @returns The parsed feature
 */
function norm(a: string | null | undefined) {
  return a === '.' || a === '' || a === undefined ? null : a
}

export function parseFieldsArray(f: (string | null | undefined)[]): GFF3FeatureLine {
  const seq_id = norm(f[0])
  const source = norm(f[1])
  const type = norm(f[2])
  const start = norm(f[3])
  const end = norm(f[4])
  const score = norm(f[5])
  const strand = norm(f[6])
  const phase = norm(f[7])
  const attrString = norm(f[8])

  return {
    seq_id: seq_id ? unescape(seq_id) : null,
    source: source ? unescape(source) : null,
    type: type ? unescape(type) : null,
    start: start === null ? null : parseInt(start, 10),
    end: end === null ? null : parseInt(end, 10),
    score: score === null ? null : parseFloat(score),
    strand,
    phase,
    attributes: attrString === null ? null : parseAttributes(attrString),
  }
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
  | null {
  const match = directiveRegex.exec(line)
  if (!match) {
    return null
  }

  const [, name] = match
  let [, , contents] = match

  const parsed: GFF3Directive = { directive: name }
  if (contents!.length) {
    contents = contents!.replace(lineEndRegex, '')
    parsed.value = contents
  }

  // do a little additional parsing for sequence-region and genome-build directives
  if (name === 'sequence-region') {
    const c = contents!.split(whitespaceRegex, 3)
    return {
      ...parsed,
      seq_id: c[0],
      start: c[1]?.replaceAll(nonDigitRegex, ''),
      end: c[2]?.replaceAll(nonDigitRegex, ''),
    } as GFF3SequenceRegionDirective
  } else if (name === 'genome-build') {
    const [source, buildName] = contents!.split(whitespaceRegex, 2)
    return {
      ...parsed,
      source,
      buildName,
    } as GFF3GenomeBuildDirective
  }

  return parsed
}

/**
 * Format an attributes object into a string suitable for the 9th column of GFF3.
 *
 * @param attrs - Attributes
 * @returns GFF3 9th column string
 */
export function formatAttributes(attrs: GFF3Attributes): string {
  const attrOrder: string[] = []
  for (const [tag, val] of Object.entries(attrs)) {
    if (!val) {
      continue
    }
    attrOrder.push(`${escape(tag)}=${val.map(escape).join(',')}`)
  }
  return attrOrder.length ? attrOrder.join(';') : '.'
}

function _formatSingleFeature(
  f: GFF3FeatureLine | GFF3FeatureLineWithRefs,
  seenFeature: Record<string, boolean | undefined>,
) {
  const attrString =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    f.attributes === null || f.attributes === undefined
      ? '.'
      : formatAttributes(f.attributes)

  const fields = [
    f.seq_id === null ? '.' : escapeColumn(f.seq_id),
    f.source === null ? '.' : escapeColumn(f.source),
    f.type === null ? '.' : escapeColumn(f.type),
    f.start === null ? '.' : escapeColumn(f.start),
    f.end === null ? '.' : escapeColumn(f.end),
    f.score === null ? '.' : escapeColumn(f.score),
    f.strand === null ? '.' : escapeColumn(f.strand),
    f.phase === null ? '.' : escapeColumn(f.phase),
    attrString,
  ]

  const formattedString = `${fields.join('\t')}\n`

  // if we have already output this exact feature, skip it
  if (seenFeature[formattedString]) {
    return ''
  }

  seenFeature[formattedString] = true
  return formattedString
}

function _formatFeature(
  feature:
    | GFF3FeatureLine
    | GFF3FeatureLineWithRefs
    | (GFF3FeatureLine | GFF3FeatureLineWithRefs)[],
  seenFeature: Record<string, boolean | undefined>,
): string {
  if (Array.isArray(feature)) {
    return feature.map(f => _formatFeature(f, seenFeature)).join('')
  }

  const strings = [_formatSingleFeature(feature, seenFeature)]
  if (_isFeatureLineWithRefs(feature)) {
    strings.push(
      ...feature.child_features.map(f => _formatFeature(f, seenFeature)),
      ...feature.derived_features.map(f => _formatFeature(f, seenFeature)),
    )
  }
  return strings.join('')
}

/**
 * Format a feature object or array of feature objects into one or more lines of
 * GFF3.
 *
 * @param featureOrFeatures - A feature object or array of feature objects
 * @returns A string of one or more GFF3 lines
 */
export function formatFeature(
  featureOrFeatures:
    | GFF3FeatureLine
    | GFF3FeatureLineWithRefs
    | (GFF3FeatureLine | GFF3FeatureLineWithRefs)[],
): string {
  const seen = {}
  return _formatFeature(featureOrFeatures, seen)
}

/**
 * Format a directive into a line of GFF3.
 *
 * @param directive - A directive object
 * @returns A directive line string
 */
export function formatDirective(directive: GFF3Directive): string {
  let str = `##${directive.directive}`
  if (directive.value) {
    str += ` ${directive.value}`
  }
  str += '\n'
  return str
}

/**
 * Format a comment into a GFF3 comment.
 * Yes I know this is just adding a # and a newline.
 *
 * @param comment - A comment object
 * @returns A comment line string
 */
export function formatComment(comment: GFF3Comment): string {
  return `# ${comment.comment}\n`
}

/**
 * Format a sequence object as FASTA
 *
 * @param seq - A sequence object
 * @returns Formatted single FASTA sequence string
 */
export function formatSequence(seq: GFF3Sequence): string {
  return `>${seq.id}${seq.description ? ` ${seq.description}` : ''}\n${
    seq.sequence
  }\n`
}

/**
 * Format a directive, comment, sequence, or feature, or array of such items,
 * into one or more lines of GFF3.
 *
 * @param itemOrItems - A comment, sequence, or feature, or array of such items
 * @returns A formatted string or array of strings
 */
export function formatItem(
  itemOrItems:
    | GFF3FeatureLineWithRefs
    | GFF3Directive
    | GFF3Comment
    | GFF3Sequence
    | (GFF3FeatureLineWithRefs | GFF3Directive | GFF3Comment | GFF3Sequence)[],
): string | string[] {
  function formatSingleItem(
    item: GFF3FeatureLineWithRefs | GFF3Directive | GFF3Comment | GFF3Sequence,
  ) {
    if ('attributes' in item) {
      return formatFeature(item)
    }
    if ('directive' in item) {
      return formatDirective(item)
    }
    if ('sequence' in item) {
      return formatSequence(item)
    }
    if ('comment' in item) {
      return formatComment(item)
    }
    return '# (invalid item found during format)\n'
  }

  if (Array.isArray(itemOrItems)) {
    return itemOrItems.map(formatSingleItem)
  }
  return formatSingleItem(itemOrItems)
}

/** A record of GFF3 attribute identifiers and the values of those identifiers */
export type GFF3Attributes = Record<string, string[] | undefined>

/** A representation of a single line of a GFF3 file */
export interface GFF3FeatureLine {
  /** The ID of the landmark used to establish the coordinate system for the current feature */
  seq_id: string | null
  /** A free text qualifier intended to describe the algorithm or operating procedure that generated this feature */
  source: string | null
  /** The type of the feature */
  type: string | null
  /** The start coordinates of the feature */
  start: number | null
  /** The end coordinates of the feature */
  end: number | null
  /** The score of the feature */
  score: number | null
  /** The strand of the feature */
  strand: string | null
  /** For features of type "CDS", the phase indicates where the next codon begins relative to the 5' end of the current CDS feature */
  phase: string | null
  /** Feature attributes */
  attributes: GFF3Attributes | null
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

function _isFeatureLineWithRefs(
  featureLine: GFF3FeatureLine | GFF3FeatureLineWithRefs,
): featureLine is GFF3FeatureLineWithRefs {
  return (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (featureLine as GFF3FeatureLineWithRefs).child_features !== undefined &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (featureLine as GFF3FeatureLineWithRefs).derived_features !== undefined
  )
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
