import { parseStringSync } from './api'

import * as util from './util'

export default {
  parseStringSync,
  util,
}

export {
  type GFF3Comment,
  type GFF3Feature,
  type GFF3Directive,
  type GFF3FeatureLineWithRefs,
  type GFF3FeatureLine,
  type GFF3Item,
  type GFF3Sequence,
} from './api'
