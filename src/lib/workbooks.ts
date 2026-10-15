// Writes the two Excel files of a session. Loaded lazily: ExcelJS is large.

import ExcelJS from 'exceljs'
import type { RawCell } from './rheoml'
import { averageGrid, type GridCell, type Session } from './session'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
// Built-in Excel formats 14 and 21: short date in the user's locale, h:mm:ss.
const DATE_FORMAT = 'mm-dd-yy'
const TIME_FORMAT = 'h:mm:ss'

function cellWidth(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'object') return 10
  return String(value).length
}

function fitColumns(ws: ExcelJS.Worksheet, rows: unknown[][]) {
  const widths: number[] = []
  for (const row of rows) row.forEach((v, i) => (widths[i] = Math.max(widths[i] ?? 0, cellWidth(v))))
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = Math.min(Math.max(w + 2, 8), 80)))
}

function excelValue(cell: RawCell): string | number | null {
  return cell !== null && typeof cell === 'object' ? cell.serial : cell
}

/** One tab per measurement with every row, as an Excel table. */
export function buildRawWorkbook(session: Session): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  session.measurements.forEach(({ measurement, sheetName }, i) => {
    const ws = wb.addWorksheet(sheetName)
    ws.addTable({
      name: `Tabla${i + 1}`,
      ref: 'A1',
      headerRow: true,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: measurement.rawHeader.map((name) => ({ name, filterButton: true })),
      rows: measurement.rawRows.map((row) => row.map(excelValue)),
    })
    measurement.rawRows.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell !== null && typeof cell === 'object') {
          ws.getCell(r + 2, c + 1).numFmt = cell.kind === 'date' ? DATE_FORMAT : TIME_FORMAT
        }
      }),
    )
    fitColumns(ws, [measurement.rawHeader, ...measurement.rawRows])
  })
  return wb
}

function gridValue(cell: GridCell): ExcelJS.CellValue {
  if (cell !== null && typeof cell === 'object') {
    return cell.result === null ? { formula: cell.formula } : { formula: cell.formula, result: cell.result }
  }
  return cell
}

/** One tab per sample with the replicates side by side and their average. */
export function buildAverageWorkbook(session: Session): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  for (const sample of session.samples) {
    const ws = wb.addWorksheet(sample.sheetName)
    const grid = averageGrid(sample)
    grid.forEach((row) => ws.addRow(row.map(gridValue)))
    fitColumns(ws, grid.slice(0, 1))
  }
  return wb
}

export async function toBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME })
}

export const rawFileName = (session: Session) => `${session.folder}.xlsx`
export const averageFileName = (session: Session) => `${session.folder} average.xlsx`
