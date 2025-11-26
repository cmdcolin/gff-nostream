import fs from 'fs'
import { gunzipSync } from 'zlib'

import { expect, test } from 'vitest'

import { parseStringSync } from '../src/index.ts'

test('large weird file', () => {
  const data = JSON.parse(
    gunzipSync(fs.readFileSync('test/data/data.json.gz')).toString(),
  )
  const ret = data.join('\n')
  const d2 = parseStringSync(ret)
  expect(d2).toBeTruthy()
})
