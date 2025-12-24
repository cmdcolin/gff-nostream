import fs from 'fs'

import { describe, expect, it } from 'vitest'

import { parseRecords, parseStringSync } from '../src/index.ts'

describe('GFF3 parser', () => {
  it('can parse gff3_with_syncs.gff3', () => {
    const stuff = parseStringSync(
      fs.readFileSync('test/data/gff3_with_syncs.gff3', 'utf8'),
    )
    expect(stuff).toMatchSnapshot()
  })
  ;(
    [
      [1010, 'messy_protein_domains.gff3'],
      [4, 'gff3_with_syncs.gff3'],
      [51, 'au9_scaffold_subset.gff3'],
      [14, 'tomato_chr4_head.gff3'],
      [5, 'directives.gff3'],
      [5, 'hybrid1.gff3'],
      [3, 'hybrid2.gff3'],
      [6, 'knownGene.gff3'],
      [6, 'knownGene2.gff3'],
      [16, 'tomato_test.gff3'],
      [3, 'spec_eden.gff3'],
      [1, 'spec_match.gff3'],
      [8, 'quantitative.gff3'],
    ] as const
  ).forEach(([_count, filename]) => {
    it(`can cursorily parse ${filename}`, () => {
      const stuff = parseStringSync(
        fs.readFileSync(`test/data/${filename}`, 'utf8'),
      )
      expect(stuff).toMatchSnapshot()
    })
  })

  it('can parse the EDEN gene from the gff3 spec', () => {
    const stuff = parseStringSync(
      fs.readFileSync('test/data/spec_eden.gff3', 'utf8'),
    )
    expect(stuff).toMatchSnapshot()
  })

  it('can parse an excerpt of the refGene gff3', () => {
    const stuff = parseStringSync(
      fs.readFileSync('test/data/refGene_excerpt.gff3', 'utf8'),
    )
    expect(stuff).toMatchSnapshot()
  })

  it('can parse an excerpt of the TAIR10 gff3', () => {
    const stuff = parseStringSync(
      fs.readFileSync('test/data/tair10.gff3', 'utf8'),
    )
    expect(stuff).toMatchSnapshot()
  })

  it('can parse chr1 TAIR10 gff3', () => {
    parseStringSync(fs.readFileSync('test/data/tair10_chr1.gff', 'utf8'))
  })

  it('can parse a string synchronously', () => {
    const gff3 = fs.readFileSync('test/data/spec_eden.gff3').toString('utf8')
    const result = parseStringSync(gff3)
    expect(result).toMatchSnapshot()
  })

  it('can parse LineRecord objects with lineHash', () => {
    const records = [
      {
        line: 'ctg123\t.\tgene\t1000\t9000\t.\t+\t.\tID=gene00001',
        lineHash: 'hash123',
        start: 1000,
        end: 9000,
        hasEscapes: false,
      },
      {
        line: 'ctg123\t.\tmRNA\t1050\t9000\t.\t+\t.\tID=mRNA00001;Parent=gene00001',
        lineHash: 456,
        start: 1050,
        end: 9000,
        hasEscapes: false,
      },
    ]
    const result = parseRecords(records)
    expect(result.length).toBe(1)
    expect(result[0]?.[0]?.attributes?._lineHash).toEqual(['hash123'])
    expect(
      result[0]?.[0]?.child_features[0]?.[0]?.attributes?._lineHash,
    ).toEqual(['456'])
  })

  it('can parse LineRecord objects without lineHash', () => {
    const records = [
      {
        line: 'ctg123\t.\tgene\t1000\t9000\t.\t+\t.\tID=gene00001',
        start: 1000,
        end: 9000,
        hasEscapes: false,
      },
    ]
    const result = parseRecords(records)
    expect(result.length).toBe(1)
    expect(result[0]?.[0]?.attributes?._lineHash).toBeUndefined()
    expect(result[0]?.[0]?.attributes?.ID).toEqual(['gene00001'])
  })

  it('can parse LineRecord objects with empty attributes', () => {
    const records = [
      {
        line: 'ctg123\t.\tgene\t1000\t9000\t.\t+\t.\t.',
        lineHash: 'hashOnly',
        start: 1000,
        end: 9000,
        hasEscapes: false,
      },
    ]
    const result = parseRecords(records)
    expect(result.length).toBe(1)
    expect(result[0]?.[0]?.attributes?._lineHash).toEqual(['hashOnly'])
  })

  it('can parse some whitespace and escapes', () => {
    const gff3 = `
SL2.40%25ch01	IT%25AG eugene	g%25e;ne	80999140	81004317	.	+	.	multivalue=val1,val2,val3;testing=blah
`

    const result = parseStringSync(gff3)
    const referenceResult = [
      [
        {
          seq_id: 'SL2.40%ch01',
          source: 'IT%AG eugene',
          type: 'g%e;ne',
          start: 80999140,
          end: 81004317,
          score: null,
          strand: '+',
          phase: null,
          attributes: {
            multivalue: ['val1', 'val2', 'val3'],
            testing: ['blah'],
          },
          child_features: [],
          derived_features: [],
        },
      ],
    ]

    expect(result).toEqual(referenceResult)
  })

  it('can parse another string synchronously', () => {
    const gff3 = `
SL2.40%25ch01	IT%25AG eugene	g%25e;ne	80999140	81004317	.	+	.	Alias=Solyc01g098840;ID=gene:Solyc01g098840.2;Name=Solyc01g098840.2;from_BOGAS=1;length=5178
`

    const result = parseStringSync(gff3)
    expect(result).toMatchSnapshot()
  })
})
