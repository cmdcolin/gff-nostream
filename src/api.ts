import Parser from './parse'
import { GFF3Feature, GFF3FeatureLine, parseFieldsArray } from './util'

export interface LineRecord {
  fields: string[]
  lineHash?: string | number
}

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

/**
 * Synchronously parse an array of strings containing GFF3 and return an array of the
 * parsed items.
 *
 * @param arr - GFF3 array of strings
 * @param inputOptions - Parsing options
 * @returns array of parsed features, directives, comments and/or sequences
 */
export function parseArraySync(arr: string[]): GFF3Feature[] {
  const items: GFF3Feature[] = []
  const parser = new Parser({
    featureCallback: arg => items.push(arg),
    disableDerivesFromReferences: true,
    errorCallback: err => {
      throw new Error(err)
    },
  })

  for (const line of arr) {
    parser.addLine(line)
  }
  parser.finish()

  return items
}

/**
 * Synchronously parse an array of LineRecord objects containing pre-split GFF3
 * fields and return an array of the parsed items.
 *
 * @param records - Array of LineRecord objects with fields array and optional lineHash
 * @returns array of parsed features
 */
export function parseRecordsSync(records: LineRecord[]): GFF3Feature[] {
  const items: GFF3Feature[] = []
  const parser = new Parser({
    featureCallback: arg => items.push(arg),
    disableDerivesFromReferences: true,
    errorCallback: err => {
      throw new Error(err)
    },
  })

  for (const record of records) {
    const featureLine: GFF3FeatureLine = parseFieldsArray(record.fields)
    if (record.lineHash !== undefined) {
      if (!featureLine.attributes) {
        featureLine.attributes = {}
      }
      featureLine.attributes._lineHash = [String(record.lineHash)]
    }
    parser.addParsedFeatureLine(featureLine)
  }
  parser.finish()

  return items
}

export {
  type GFF3Comment,
  type GFF3Directive,
  type GFF3Feature,
  type GFF3FeatureLine,
  type GFF3FeatureLineWithRefs,
  type GFF3Item,
  type GFF3Sequence,
} from './util'
