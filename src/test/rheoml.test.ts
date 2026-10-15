import { describe, expect, it } from 'vitest'
import { NotRheoMLError, parseRheoML } from '../lib/rheoml'
import { amplitudeSweep, frequencySweep, rheomlXml } from './fixture'

// Column names Excel gives the same file when opened "as an XML table".
const EXCEL_HEADER = [
  'Organization', 'Date', 'Time', 'Operator', 'RawDataFile', 'SampleName', 'SampleHistory', 'Comment',
  'EquipmentName', 'MeasurementAtmosphere', 'Comment2', 'DeformationType', 'DMAModulusType', 'Radius', 'unit',
  'Gap', 'unit3', 'DataType', 'SegmentNumber', 'Time4', 'unit5', 'SegmentTime', 'unit6', 'Temperature', 'unit7',
  'Frequency', 'unit8', 'StorageModulus', 'unit9', 'LossModulus', 'unit10', 'StressAmpl', 'unit11', 'StrainAmpl',
  'unit12', 'LossFactor', 'unit13', 'AngDisplAmpl', 'unit14', 'TorqueAmpl', 'unit15', 'ComplexViscosity', 'unit16',
]

describe('parseRheoML', () => {
  const xml = rheomlXml({
    sample: 'HAtyr 100',
    file: 'HAtyr 100',
    folder: '2026-09-30 HAtyr Gel tyr Reologia 1D',
    date: '2026-09-30',
    time: '10:14:17',
    segments: [amplitudeSweep(), frequencySweep(100)],
  })
  const m = parseRheoML(xml, 'HAtyr 100.xml')

  it('names the columns exactly as Excel does', () => {
    expect(m.rawHeader).toEqual(EXCEL_HEADER)
  })

  it('keeps one row per data point, all segments included', () => {
    expect(m.rawRows).toHaveLength(36)
    expect(m.points).toHaveLength(36)
    expect(m.rawRows.every((r) => r.length === EXCEL_HEADER.length)).toBe(true)
  })

  it('types every cell like Excel', () => {
    const row = Object.fromEntries(EXCEL_HEADER.map((h, i) => [h, m.rawRows[16][i]]))
    expect(row.Date).toEqual({ kind: 'date', serial: 46295 })
    expect(row.Time).toEqual({ kind: 'time', serial: (10 * 3600 + 14 * 60 + 17) / 86400 })
    expect(row.Comment).toBeNull()
    expect(row.SampleHistory).toBeNull()
    expect(row.EquipmentName).toBe('1234-5678')
    expect(row.Radius).toBe(4)
    expect(row.unit).toBe('mm')
    expect(row.SegmentNumber).toBe(2)
    expect(row.Frequency).toBe(0.1)
    expect(row.StorageModulus).toBe(100)
    expect(row.unit13).toBe('-')
    expect(row.unit16).toBe('Pa.s')
  })

  it('reads sample, measurement time and lab folder', () => {
    expect(m.fileName).toBe('HAtyr 100')
    expect(m.sampleName).toBe('HAtyr 100')
    expect(m.measuredAt).toBe('2026-09-30T10:14:17')
    expect(m.sessionFolder).toBe('2026-09-30 HAtyr Gel tyr Reologia 1D')
  })

  it('keeps the file name literally, "-2" included', () => {
    expect(parseRheoML(xml, 'HATyr 100 (1)-2.xml').fileName).toBe('HATyr 100 (1)-2')
  })

  it('falls back to the folder the file was dropped from, as it is', () => {
    const noRaw = rheomlXml({ sample: 'S', file: 'S', rawDataFile: null, segments: [frequencySweep(1)] })
    expect(parseRheoML(noRaw, 'S.xml', '2026-10-06 Ensayo (2)').sessionFolder).toBe('2026-10-06 Ensayo (2)')
    expect(parseRheoML(noRaw, 'S.xml').sessionFolder).toBe('Reologia')
  })

  it('rejects XML that is not from the rheometer', () => {
    expect(() => parseRheoML('<other/>', 'x.xml')).toThrow(NotRheoMLError)
    expect(() => parseRheoML('not xml', 'x.xml')).toThrow(NotRheoMLError)
  })
})
