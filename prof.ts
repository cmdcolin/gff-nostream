import { parseStringSync } from './src/index.ts'
import fs from 'fs'
const ret = parseStringSync(
  fs.readFileSync('test/data/tair10_chr1.gff', 'utf8'),
)
