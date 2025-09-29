import fs from 'fs'

import { describe, expect, it } from 'vitest'

import { parseStringSync, parseArraySync } from '../src'

describe('GFF3 parser', () => {
  it('can parse gff3_with_syncs.gff3', async () => {
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
    it(`can cursorily parse ${filename}`, async () => {
      const stuff = parseStringSync(
        fs.readFileSync(`test/data/${filename}`, 'utf8'),
      )
      expect(stuff).toMatchSnapshot()
    })
  })

  it('supports children before parents, and Derives_from', async () => {
    const stuff = parseStringSync(
      fs.readFileSync('test/data/knownGene_out_of_order.gff3', 'utf8'),
    )
    expect(stuff).toMatchSnapshot()
  })

  it('can parse the EDEN gene from the gff3 spec', async () => {
    const stuff = parseStringSync(
      fs.readFileSync('test/data/spec_eden.gff3', 'utf8'),
    )
    expect(stuff).toMatchSnapshot()
  })

  it('can parse an excerpt of the refGene gff3', async () => {
    const stuff = parseStringSync(
      fs.readFileSync('test/data/refGene_excerpt.gff3', 'utf8'),
    )
    expect(stuff).toMatchSnapshot()
  })

  it('can parse an excerpt of the TAIR10 gff3', async () => {
    const stuff = parseStringSync(
      fs.readFileSync('test/data/tair10.gff3', 'utf8'),
    )
    expect(stuff).toMatchSnapshot()
  })

  it('can parse chr1 TAIR10 gff3', async () => {
    parseStringSync(fs.readFileSync('test/data/tair10_chr1.gff', 'utf8'))
  })

  // check that some files throw a parse error
  ;['mm9_sample_ensembl.gff3', 'Saccharomyces_cerevisiae_EF3_e64.gff3'].forEach(
    errorFile => {
      it(`throws an error when parsing ${errorFile}`, async () => {
        try {
          parseStringSync(fs.readFileSync(`test/data/${errorFile}`, 'utf8'))
        } catch (e) {
          expect(e).toMatch(/inconsistent types/)
        }
      })
    },
  )

  it('can parse a string synchronously', () => {
    const gff3 = fs.readFileSync('test/data/spec_eden.gff3').toString('utf8')
    const result = parseStringSync(gff3)
    expect(result).toMatchSnapshot()
  })

  it('can parse an array of strings synchronously', () => {
    const gff3 = [
      '##gff-version 3',
      'ctg123	.	gene	1000	9000	.	+	.	ID=gene00001',
      'ctg123	.	mRNA	1050	9000	.	+	.	ID=mRNA00001;Parent=gene00001',
    ]
    const result = parseArraySync(gff3)
    expect(result).toMatchSnapshot()
  })

  it('can parse some whitespace', () => {
    const gff3 = `
SL2.40%25ch01	IT%25AG eugene	g%25e;ne	80999140	81004317	.	+	.	 multivalue = val1,val2, val3;testing = blah
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
  ;(
    [
      [
        'hybrid1.gff3',
        [
          {
            id: 'A00469',
            sequence: 'GATTACAGATTACA',
          },
          {
            id: 'zonker',
            sequence:
              'AAAAAACTAGCATGATCGATCGATCGATCGATATTAGCATGCATGCATGATGATGATAGCTATGATCGATCCCCCCCAAAAAACTAGCATGATCGATCGATCGATCGATATTAGCATGCATGCATGATGATGATAGCTATGATCGATCCCCCCC',
          },
          {
            id: 'zeebo',
            description: 'this is a test description',
            sequence:
              'AAAAACTAGTAGCTAGCTAGCTGATCATAGATCGATGCATGGCATACTGACTGATCGACCCCCC',
          },
        ],
      ],
      [
        'hybrid2.gff3',
        [
          {
            id: 'A00469',
            sequence: 'GATTACAWATTACABATTACAGATTACA',
          },
        ],
      ],
    ] as const
  ).forEach(([filename]) => {
    it(`can parse FASTA sections in hybrid ${filename} file`, async () => {
      const stuff = parseStringSync(
        fs.readFileSync(`test/data/${filename}`, 'utf8'),
      )
      expect(stuff).toMatchSnapshot()
    })
  })
})
