import Parser from './parse'
import {
  GFF3Comment,
  GFF3Directive,
  GFF3Feature,
  GFF3Item,
  GFF3Sequence,
  parseFeature,
} from './util'

/** Parser options */
export interface ParseOptions {
  /** Whether to resolve references to derives from features */
  disableDerivesFromReferences?: boolean
  /** Text encoding of the input GFF3. default 'utf8' */
  encoding?: BufferEncoding
  /** Whether to parse features, default true */
  parseFeatures?: boolean
  /** Whether to parse directives, default false */
  parseDirectives?: boolean
  /** Whether to parse comments, default false */
  parseComments?: boolean
  /** Whether to parse sequences, default true */
  parseSequences?: boolean
  /**
   * Parse all features, directives, comments, and sequences. Overrides other
   * parsing options. Default false.
   */
  parseAll?: boolean
}

type ParseOptionsProcessed = Required<Omit<ParseOptions, 'parseAll'>>

/**
 * Synchronously parse a string containing GFF3 and return an array of the
 * parsed items.
 *
 * @param str - GFF3 string
 * @param inputOptions - Parsing options
 * @returns array of parsed features, directives, comments and/or sequences
 */
export function parseStringSync(str: string): GFF3Feature[] {
  const items: GFF3Feature[] = []
  const parser = new Parser({
    featureCallback: arg => items.push(arg),
    disableDerivesFromReferences: true,
    errorCallback: err => {
      throw err
    },
  })

  for (const line of str.split(/\r?\n/)) {
    parser.addLine(line)
  }
  parser.finish()

  return items
}

export {
  type GFF3FeatureLine,
  type GFF3Comment,
  type GFF3FeatureLineWithRefs,
  type GFF3Directive,
  type GFF3Sequence,
  type GFF3Feature,
  type GFF3Item,
} from './util'
