import { describe, expect, it } from 'vitest'
import { parseRheoML } from '../lib/rheoml'
import { averageGrid, buildSessions, columnLetter, excelSheetNames, rowsFromStartFrequency } from '../lib/session'
import { amplitudeSweep, frequencySweep, rheomlXml, SWEEP_FREQUENCIES, type FixtureOptions } from './fixture'

const parse = (o: FixtureOptions) => parseRheoML(rheomlXml(o), `${o.file}.xml`)

describe('rowsFromStartFrequency', () => {
  it('ignores every row before the first one at 0.1 Hz', () => {
    const m = parse({ sample: 'S', file: 'S', segments: [amplitudeSweep(), frequencySweep(100)] })
    const rows = rowsFromStartFrequency(m.points)!
    expect(rows).toHaveLength(20)
    expect(rows[0].Frequency).toBe(0.1)
    expect(rows[0].StorageModulus).toBe(100)
  })

  it('returns null when there is no 0.1 Hz row', () => {
    const m = parse({ sample: 'S', file: 'S', segments: [amplitudeSweep()] })
    expect(rowsFromStartFrequency(m.points)).toBeNull()
  })
})

describe('buildSessions', () => {
  const day = [
    parse({ sample: 'Geltyr 100', file: 'Geltyr 100', time: '12:40:00', segments: [amplitudeSweep(), frequencySweep(300)] }),
    parse({ sample: 'HAtyr 100', file: 'HAtyr 100 (1)', time: '10:22:00', segments: [frequencySweep(200)] }),
    parse({ sample: 'HAtyr 100', file: 'HAtyr 100', time: '10:14:00', segments: [amplitudeSweep(), frequencySweep(100)] }),
    parse({ sample: 'HAtyr 100', file: 'HAtyr 100 (2)', time: '10:31:00', segments: [frequencySweep(300)] }),
    parse({ sample: 'Geltyr 100', file: 'Geltyr 100 (1)', time: '12:48:00', segments: [frequencySweep(500)] }),
  ]
  const [session] = buildSessions(day)

  it('orders tabs by measurement time, named after the file', () => {
    expect(session.measurements.map((m) => m.sheetName)).toEqual([
      'HAtyr 100', 'HAtyr 100 (1)', 'HAtyr 100 (2)', 'Geltyr 100', 'Geltyr 100 (1)',
    ])
  })

  it('groups replicates by sample, in measurement order', () => {
    expect(session.samples.map((s) => [s.sheetName, s.replicates.map((r) => r.measurement.fileName)])).toEqual([
      ['HAtyr 100', ['HAtyr 100', 'HAtyr 100 (1)', 'HAtyr 100 (2)']],
      ['Geltyr 100', ['Geltyr 100', 'Geltyr 100 (1)']],
    ])
    expect(session.warnings).toEqual([])
  })

  it('splits files saved in different lab folders', () => {
    const other = parse({ sample: 'HAtyr 100', file: 'HAtyr 100', folder: '2026-02-01 Otro', segments: [frequencySweep(1)] })
    expect(buildSessions([...day, other]).map((s) => s.folder)).toEqual(['2026-01-15 Prueba D1 N1', '2026-02-01 Otro'])
  })

  it('warns about a file without a 0.1 Hz row and leaves it out of the averages', () => {
    const [s] = buildSessions([...day, parse({ sample: 'X', file: 'X', segments: [amplitudeSweep()] })])
    expect(s.measurements).toHaveLength(6)
    expect(s.samples.map((x) => x.name)).not.toContain('X')
    expect(s.warnings).toEqual([expect.stringContaining('«X» no tiene ninguna fila a 0.1 Hz')])
  })

  it('warns when replicates were measured at different frequencies', () => {
    const odd = parse({ sample: 'HAtyr 100', file: 'HAtyr 100 (3)', segments: [frequencySweep(1, SWEEP_FREQUENCIES.slice(0, 10))] })
    const [s] = buildSessions([...day, odd])
    expect(s.warnings).toEqual([expect.stringContaining('En «HAtyr 100» las medidas no tienen las mismas frecuencias')])
  })
})

describe('averageGrid', () => {
  const [session] = buildSessions([
    parse({ sample: 'HAtyr 100', file: 'HAtyr 100', time: '10:00:00', segments: [amplitudeSweep(), frequencySweep(100)] }),
    parse({ sample: 'HAtyr 100', file: 'HAtyr 100 (1)', time: '10:10:00', segments: [frequencySweep(200)] }),
    parse({ sample: 'HAtyr 100', file: 'HAtyr 100 (2)', time: '10:20:00', segments: [frequencySweep(600)] }),
    parse({ sample: 'Geltyr 100', file: 'Geltyr 100', time: '11:00:00', segments: [amplitudeSweep(), frequencySweep(10)] }),
    parse({ sample: 'Geltyr 100', file: 'Geltyr 100 (1)', time: '11:10:00', segments: [frequencySweep(30)] }),
  ])
  const [threeReplicates, twoReplicates] = session.samples.map(averageGrid)

  it('labels each column with the file it comes from', () => {
    expect(threeReplicates[0]).toEqual([
      'Frequency',
      'StorageModulus HAtyr 100', 'StorageModulus HAtyr 100 (1)', 'StorageModulus HAtyr 100 (2)', 'Average',
      null,
      'LossModulus HAtyr 100', 'LossModulus HAtyr 100 (1)', 'LossModulus HAtyr 100 (2)', 'Average',
    ])
  })

  it('has one row per frequency, from 0.1 Hz', () => {
    expect(threeReplicates).toHaveLength(21)
    expect(threeReplicates.slice(1).map((r) => r[0])).toEqual(SWEEP_FREQUENCIES)
  })

  it('averages with an Excel formula on the same row', () => {
    expect(threeReplicates[1]).toEqual([
      0.1, 100, 200, 600, { formula: 'AVERAGE(B2:D2)', result: 300 },
      null, 10, 20, 60, { formula: 'AVERAGE(G2:I2)', result: 30 },
    ])
    expect(threeReplicates[20][4]).toEqual({ formula: 'AVERAGE(B21:D21)', result: 319 })
  })

  it('adapts to however many replicates there are', () => {
    expect(twoReplicates[1]).toEqual([
      0.1, 10, 30, { formula: 'AVERAGE(B2:C2)', result: 20 },
      null, 1, 3, { formula: 'AVERAGE(F2:G2)', result: 2 },
    ])
  })

  it('keeps negative values in the average, as she does', () => {
    const [s] = buildSessions([
      parse({ sample: 'S', file: 'S', time: '10:00:00', segments: [frequencySweep(-100)] }),
      parse({ sample: 'S', file: 'S (1)', time: '10:10:00', segments: [frequencySweep(300)] }),
    ])
    expect(averageGrid(s.samples[0])[1][3]).toEqual({ formula: 'AVERAGE(B2:C2)', result: 100 })
  })
})

describe('excelSheetNames', () => {
  it('fixes names Excel would reject and keeps them unique', () => {
    expect(excelSheetNames(['a/b', 'HAtyr 100', 'HATYR 100', 'x'.repeat(40)])).toEqual([
      'a_b', 'HAtyr 100', 'HATYR 100_2', 'x'.repeat(31),
    ])
  })
})

describe('columnLetter', () => {
  it('counts like Excel', () => {
    expect([0, 1, 25, 26, 42].map(columnLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AQ'])
  })
})
