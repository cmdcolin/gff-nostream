import Parser from './parse'
import { GFF3Feature } from './util'

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
      throw new Error(err)
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
