import {
  parseFeature,
  parseFeatureJBrowse,
  parseFeatureJBrowseNoUnescape,
  parseFeatureNoUnescape,
} from './util.ts'

import type {
  GFF3Feature,
  GFF3FeatureLineWithRefs,
  JBrowseFeature,
} from './util.ts'

export interface LineRecord {
  line: string
  lineHash?: string | number
  start: number
  end: number
  hasEscapes: boolean
}

/**
 * Synchronously parse a string containing GFF3 and return an array of the
 * parsed items.
 *
 * @param str - GFF3 string
 * @returns array of parsed features
 */
export function parseStringSync(str: string): GFF3Feature[] {
  return parseRecords(stringToRecords(str))
}

/**
 * Synchronously parse a string containing GFF3 directly into JBrowse format.
 *
 * @param str - GFF3 string
 * @returns array of JBrowse-format features
 */
export function parseStringSyncJBrowse(str: string): JBrowseFeature[] {
  return parseRecordsJBrowse(stringToRecords(str))
}

function stringToRecords(str: string) {
  const lines = str.split(/\r?\n/)
  const records: LineRecord[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.length === 0 || line[0] === '#') {
      if (line.startsWith('##FASTA')) {
        break
      }
      continue
    }
    if (line[0] === '>') {
      break
    }
    records.push({
      line,
      start: 0,
      end: 0,
      hasEscapes: line.includes('%'),
    })
  }
  return records
}

/**
 * Parse an array of LineRecord objects containing raw GFF3 lines.
 * Supports parent/child relationships.
 *
 * @param records - Array of LineRecord objects with raw line and metadata
 * @returns array of parsed features
 */
export function parseRecords(records: LineRecord[]): GFF3Feature[] {
  const items: GFF3Feature[] = []
  const byId = new Map<string, GFF3Feature>()
  const orphans = new Map<string, GFF3Feature[]>()

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!
    const featureLine = (
      record.hasEscapes
        ? parseFeature(record.line)
        : parseFeatureNoUnescape(record.line)
    ) as GFF3FeatureLineWithRefs
    featureLine.child_features = []
    featureLine.derived_features = []

    if (record.lineHash !== undefined) {
      if (!featureLine.attributes) {
        featureLine.attributes = {}
      }
      featureLine.attributes._lineHash = [String(record.lineHash)]
    }

    const attrs = featureLine.attributes
    const ids = attrs?.ID
    const parents = attrs?.Parent

    if (!ids && !parents) {
      items.push([featureLine])
      continue
    }

    let feature: GFF3Feature
    if (ids) {
      const id = ids[0]!
      const existing = byId.get(id)
      if (existing) {
        existing.push(featureLine)
        feature = existing
      } else {
        feature = [featureLine]
        if (!parents) {
          items.push(feature)
        }
        byId.set(id, feature)
        const waiting = orphans.get(id)
        if (waiting) {
          for (let j = 0; j < waiting.length; j++) {
            featureLine.child_features.push(waiting[j]!)
          }
          orphans.delete(id)
        }
      }
    } else {
      feature = [featureLine]
    }

    if (parents) {
      for (let j = 0; j < parents.length; j++) {
        const parentId = parents[j]!
        const parent = byId.get(parentId)
        if (parent) {
          for (let k = 0; k < parent.length; k++) {
            parent[k]!.child_features.push(feature)
          }
        } else {
          let arr = orphans.get(parentId)
          if (!arr) {
            arr = []
            orphans.set(parentId, arr)
          }
          arr.push(feature)
        }
      }
    }
  }

  return items
}

/**
 * Parse an array of LineRecord objects directly into JBrowse feature format.
 * Supports parent/child relationships via subfeatures.
 *
 * @param records - Array of LineRecord objects with raw line and metadata
 * @returns array of JBrowse-format features
 */
export function parseRecordsJBrowse(records: LineRecord[]): JBrowseFeature[] {
  const items: JBrowseFeature[] = []
  const byId = new Map<string, JBrowseFeature>()
  const orphans = new Map<string, JBrowseFeature[]>()

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!
    const feature = record.hasEscapes
      ? parseFeatureJBrowse(record.line)
      : parseFeatureJBrowseNoUnescape(record.line)

    if (record.lineHash !== undefined) {
      feature._lineHash = String(record.lineHash)
    }

    const id = feature.id as string | undefined
    const parent = feature.parent as string | string[] | undefined

    if (!id && !parent) {
      items.push(feature)
      continue
    }

    if (id) {
      const existing = byId.get(id)
      if (!existing) {
        if (!parent) {
          items.push(feature)
        }
        byId.set(id, feature)
        const waiting = orphans.get(id)
        if (waiting) {
          for (let j = 0; j < waiting.length; j++) {
            feature.subfeatures.push(waiting[j]!)
          }
          orphans.delete(id)
        }
      }
    }

    if (parent) {
      const parents = Array.isArray(parent) ? parent : [parent]
      for (let j = 0; j < parents.length; j++) {
        const parentId = parents[j]!
        const parentFeature = byId.get(parentId)
        if (parentFeature) {
          parentFeature.subfeatures.push(feature)
        } else {
          let arr = orphans.get(parentId)
          if (!arr) {
            arr = []
            orphans.set(parentId, arr)
          }
          arr.push(feature)
        }
      }
    }
  }

  return items
}

export type {
  GFF3Comment,
  GFF3Directive,
  GFF3Feature,
  GFF3FeatureLine,
  GFF3FeatureLineWithRefs,
  GFF3Item,
  GFF3Sequence,
  JBrowseFeature,
} from './util.ts'
