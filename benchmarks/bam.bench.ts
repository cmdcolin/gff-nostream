import fs from 'fs'
import { bench, describe } from 'vitest'

import { parseStringSync as parseStringSync1 } from '../esm_branch1/index.js'
import { parseStringSync as parseStringSync2 } from '../esm_branch2/index.js'

const branch1Name = fs.readFileSync('esm_branch1/branchname.txt', 'utf8').trim()
const branch2Name = fs.readFileSync('esm_branch2/branchname.txt', 'utf8').trim()

function benchGFF(
  name: string,
  path: string,
  opts?: { iterations?: number; warmupIterations?: number },
) {
  describe(name, () => {
    const data = fs.readFileSync(path, 'utf8')
    bench(
      branch1Name,
      async () => {
        const ret = parseStringSync1(data)
      },
      opts,
    )

    bench(
      branch2Name,
      async () => {
        const ret = parseStringSync2(data)
      },
      opts,
    )
  })
}

benchGFF('ultralong', 'test/data/tair10_chr1.gff   ', {
  iterations: 100,
  warmupIterations: 5,
})
