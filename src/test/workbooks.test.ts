import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseRheoML } from '../lib/rheoml'
import { buildSessions } from '../lib/session'
import { averageFileName, buildAverageWorkbook, buildRawWorkbook, rawFileName } from '../lib/workbooks'
import { amplitudeSweep, frequencySweep, rheomlXml } from './fixture'

async function roundTrip(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const back = new ExcelJS.Workbook()
  await back.xlsx.load(await wb.xlsx.writeBuffer())
  return back
}

describe('workbooks', () => {
  const folder = '2026-10-06 HAGel D7 N1'
  const [session] = buildSessions([
    parseRheoML(
      rheomlXml({ sample: 'HATyr 100', file: 'HATyr 100', folder, time: '10:43:59', segments: [amplitudeSweep(), frequencySweep(100)] }),
      'HATyr 100-2.xml',
    ),
    parseRheoML(
      rheomlXml({ sample: 'HATyr 100', file: 'HATyr 100 (1)', folder, time: '10:55:25', segments: [frequencySweep(200)] }),
      'HATyr 100 (1)-2.xml',
    ),
  ])

  it('names the files after the lab folder', () => {
    expect(rawFileName(session)).toBe('2026-10-06 HAGel D7 N1.xlsx')
    expect(averageFileName(session)).toBe('2026-10-06 HAGel D7 N1 average.xlsx')
  })

  it('writes every measurement to its own tab as an Excel table', async () => {
    const wb = await roundTrip(buildRawWorkbook(session))
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['HATyr 100-2', 'HATyr 100 (1)-2'])

    const ws = wb.getWorksheet('HATyr 100-2')!
    expect(ws.rowCount).toBe(37)
    expect(ws.getCell('A1').value).toBe('Organization')
    expect(ws.getCell('AQ1').value).toBe('unit16')
    expect(ws.getCell('B2').numFmt).toBe('mm-dd-yy')
    expect(ws.getCell('C2').numFmt).toBe('h:mm:ss')
    expect(ws.getCell('Z18').value).toBe(0.1)
    expect(ws.getCell('H2').value).toBeNull()
    expect(Object.keys((ws as unknown as { tables: object }).tables)).toEqual(['Tabla1'])
  })

  it('writes one tab per sample with live AVERAGE formulas', async () => {
    const wb = await roundTrip(buildAverageWorkbook(session))
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['HATyr 100'])

    const ws = wb.getWorksheet('HATyr 100')!
    expect(ws.getRow(1).values).toEqual([
      undefined, 'Frequency', 'StorageModulus HATyr 100-2', 'StorageModulus HATyr 100 (1)-2', 'Average',
      undefined, 'LossModulus HATyr 100-2', 'LossModulus HATyr 100 (1)-2', 'Average',
    ])
    expect(ws.getCell('D2').value).toEqual({ formula: 'AVERAGE(B2:C2)', result: 150 })
    expect(ws.getCell('H21').value).toEqual({ formula: 'AVERAGE(F21:G21)', result: 34 })
    expect(ws.rowCount).toBe(21)
  })
})
