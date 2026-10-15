// Checks the conversion against Excel files made by hand from real lab data.
// The data is not in the repo; point REAL_DATA_DIR at a folder holding
// INPUT/<session folders with .xml> and OUTPUT/<her .xlsx files>.
//   REAL_DATA_DIR=/path/to/Marc npm test

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseRheoML, type RawCell } from '../lib/rheoml'
import { averageGrid, buildSessions, type Session } from '../lib/session'

const dir = process.env.REAL_DATA_DIR

function loadSession(folder: string): Session {
  const path = join(dir!, 'INPUT', folder)
  const measurements = readdirSync(path)
    .filter((f) => f.toLowerCase().endsWith('.xml'))
    .map((f) => parseRheoML(readFileSync(join(path, f), 'utf8'), f, folder))
  const sessions = buildSessions(measurements)
  expect(sessions).toHaveLength(1)
  return sessions[0]
}

async function loadWorkbook(name: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(join(dir!, 'OUTPUT', name))
  return wb
}

const toSerial = (v: ExcelJS.CellValue) => (v instanceof Date ? v.getTime() / 86_400_000 + 25_569 : v)
const ours = (c: RawCell) => (c !== null && typeof c === 'object' ? c.serial : c)

describe.runIf(dir)('real lab data', () => {
  const folders = dir ? readdirSync(join(dir, 'INPUT')) : []
  const day1 = folders.find((f) => f.includes('Reologia 1D'))!

  it('reproduces every value of her full Excel', async () => {
    const session = loadSession(day1)
    const theirs = await loadWorkbook('REO DIA 1.xlsx')
    const mismatches: string[] = []

    for (const ws of theirs.worksheets) {
      const rawDataFile = String(ws.getCell('E2').value)
      const source = session.measurements.find(({ measurement: m }) =>
        rawDataFile.endsWith(`\\${m.fileName}.tri`),
      )!.measurement
      expect(ws.getRow(1).values).toEqual([undefined, ...source.rawHeader])
      source.rawRows.forEach((row, r) =>
        row.forEach((cell, c) => {
          const theirValue = toSerial(ws.getCell(r + 2, c + 1).value ?? null) as unknown
          const ourValue = ours(cell)
          const equal =
            typeof ourValue === 'number' && typeof theirValue === 'number'
              ? Math.abs(ourValue - theirValue) < 1e-9
              : ourValue === theirValue
          if (!equal) mismatches.push(`${ws.name}!${ws.getCell(r + 2, c + 1).address}: ours=${ourValue} theirs=${theirValue}`)
        }),
      )
    }

    // The only difference is a stray keystroke in her file.
    expect(mismatches).toEqual([expect.stringMatching(/^HAtyr 100 \(1\)!AB3: ours=[\d.]+ theirs=z$/)])
  })

  it('averages the same numbers she averages', async () => {
    const session = loadSession(day1)
    const theirs = await loadWorkbook('REO DIA 1 average.xlsx')
    expect(session.samples.map((s) => s.replicates.length)).toEqual([3, 3, 3, 3, 2])

    for (const ws of theirs.worksheets) {
      const n = ws.getCell('E2').formula ? 3 : 2 // her "Gel 100%" tab has 2 replicates
      const storageCols = Array.from({ length: n }, (_, i) => 2 + i)
      const lossCols = Array.from({ length: n }, (_, i) => 7 + i)
      const firstStorage = Number(ws.getCell(2, 2).value)
      const sample = session.samples.find((s) => s.replicates.some((r) => r.rows[0].StorageModulus === firstStorage))!
      const grid = averageGrid(sample)

      for (let row = 2; row <= 21; row++) {
        const ourRow = grid[row - 1]
        expect(ourRow[0]).toBe(ws.getCell(row, 1).value)
        const sorted = (xs: unknown[]) => [...(xs as number[])].sort((a, b) => a - b)
        // Same replicate values (she pasted HA 100 in a different order).
        expect(sorted(ourRow.slice(1, 1 + n))).toEqual(sorted(storageCols.map((c) => ws.getCell(row, c).value)))
        expect(sorted(ourRow.slice(n + 3, 2 * n + 3))).toEqual(sorted(lossCols.map((c) => ws.getCell(row, c).value)))
      }
    }
  })

  it('handles the sessions she has not processed yet', () => {
    for (const folder of folders.filter((f) => f !== day1)) {
      const session = loadSession(folder)
      expect(session.warnings).toEqual([])
      expect(session.folder).toBe(folder.replace(/ \(POR HACER\)$/, ''))
      expect(session.measurements).toHaveLength(15)
      expect(session.samples.map((s) => s.replicates.length)).toEqual([3, 3, 3, 3, 3])
      expect(session.samples.every((s) => s.replicates.every((r) => r.rows.length === 20))).toBe(true)
    }
  })
})
