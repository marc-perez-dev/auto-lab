// Groups measurements into lab sessions and samples, and lays out the
// averages sheet of each sample.

import type { Measurement, Point } from './rheoml'

/** Rows before the first one at this frequency are ignored for averages. */
export const START_FREQUENCY_HZ = 0.1

const FREQUENCY = 'Frequency'
const AVERAGED_FIELDS = ['StorageModulus', 'LossModulus'] as const

export interface Replicate {
  measurement: Measurement
  /** Rows from the first 0.1 Hz row on. */
  rows: Point[]
}

export interface Sample {
  name: string
  sheetName: string
  replicates: Replicate[]
}

export interface Session {
  folder: string
  measurements: { measurement: Measurement; sheetName: string }[]
  samples: Sample[]
  warnings: string[]
}

export type Formula = { formula: string; result: number | null }
export type GridCell = string | number | Formula | null

const sameFrequency = (a: number | undefined, b: number | undefined) =>
  a !== undefined && b !== undefined && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))

export function rowsFromStartFrequency(points: Point[]): Point[] | null {
  const start = points.findIndex((p) => sameFrequency(p[FREQUENCY], START_FREQUENCY_HZ))
  return start === -1 ? null : points.slice(start)
}

/** Excel tab names: max 31 chars, no : \ / ? * [ ], unique ignoring case. */
export function excelSheetNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((name) => {
    const base = name.replace(/[:\\/?*[\]]/g, '_').replace(/^'+|'+$/g, '').slice(0, 31) || 'Hoja'
    let candidate = base
    for (let n = 2; used.has(candidate.toLowerCase()); n++) {
      const suffix = `_${n}`
      candidate = base.slice(0, 31 - suffix.length) + suffix
    }
    used.add(candidate.toLowerCase())
    return candidate
  })
}

function renameWarnings(names: string[], sheetNames: string[], what: string): string[] {
  return names.flatMap((name, i) =>
    name === sheetNames[i] ? [] : [`La pestaña de ${what} «${name}» se llama «${sheetNames[i]}» porque Excel no admite ese nombre.`],
  )
}

const byMeasuredAt = (a: Measurement, b: Measurement) =>
  a.measuredAt.localeCompare(b.measuredAt) || a.fileName.localeCompare(b.fileName)

function buildSession(folder: string, measurements: Measurement[]): Session {
  const ordered = [...measurements].sort(byMeasuredAt)
  const warnings: string[] = []

  const rawNames = ordered.map((m) => m.fileName)
  const rawSheetNames = excelSheetNames(rawNames)
  warnings.push(...renameWarnings(rawNames, rawSheetNames, 'la medida'))

  const bySample = new Map<string, Replicate[]>()
  for (const measurement of ordered) {
    const rows = rowsFromStartFrequency(measurement.points)
    if (!rows) {
      warnings.push(
        `«${measurement.fileName}» no tiene ninguna fila a ${START_FREQUENCY_HZ} Hz: está en el Excel completo pero no en el de medias.`,
      )
      continue
    }
    const replicates = bySample.get(measurement.sampleName) ?? []
    replicates.push({ measurement, rows })
    bySample.set(measurement.sampleName, replicates)
  }

  const sampleNames = [...bySample.keys()]
  const sampleSheetNames = excelSheetNames(sampleNames)
  warnings.push(...renameWarnings(sampleNames, sampleSheetNames, 'la muestra'))

  const samples = sampleNames.map((name, i) => ({ name, sheetName: sampleSheetNames[i], replicates: bySample.get(name)! }))
  for (const sample of samples) {
    if (!frequenciesMatch(sample)) {
      warnings.push(`En «${sample.name}» las medidas no tienen las mismas frecuencias: revisa sus medias a mano.`)
    }
  }

  return {
    folder,
    measurements: ordered.map((measurement, i) => ({ measurement, sheetName: rawSheetNames[i] })),
    samples,
    warnings,
  }
}

export function buildSessions(measurements: Measurement[]): Session[] {
  const byFolder = new Map<string, Measurement[]>()
  for (const m of measurements) byFolder.set(m.sessionFolder, [...(byFolder.get(m.sessionFolder) ?? []), m])
  return [...byFolder.entries()]
    .map(([folder, ms]) => buildSession(folder, ms))
    .sort((a, b) => a.folder.localeCompare(b.folder))
}

function longestReplicate(sample: Sample): Replicate {
  return sample.replicates.reduce((best, r) => (r.rows.length > best.rows.length ? r : best))
}

export function frequenciesMatch(sample: Sample): boolean {
  const reference = longestReplicate(sample).rows
  return sample.replicates.every(
    (r) => r.rows.length === reference.length && r.rows.every((p, i) => sameFrequency(p[FREQUENCY], reference[i][FREQUENCY])),
  )
}

export function columnLetter(index: number): string {
  let n = index + 1
  let letters = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

/**
 * Frequency | StorageModulus <file>… | Average | (blank) | LossModulus <file>… | Average
 * Replicates are pasted side by side, as she does by hand.
 */
export function averageGrid(sample: Sample): GridCell[][] {
  const n = sample.replicates.length
  const header: GridCell[] = [FREQUENCY]
  AVERAGED_FIELDS.forEach((field, block) => {
    if (block > 0) header.push(null)
    header.push(...sample.replicates.map((r) => `${field} ${r.measurement.fileName}`), 'Average')
  })

  const reference = longestReplicate(sample).rows
  const rows = reference.map((refPoint, i) => {
    const excelRow = i + 2
    const row: GridCell[] = [refPoint[FREQUENCY] ?? null]
    AVERAGED_FIELDS.forEach((field, block) => {
      if (block > 0) row.push(null)
      const firstCol = row.length
      const values = sample.replicates.map((r) => r.rows[i]?.[field] ?? null)
      row.push(...values)
      const present = values.filter((v): v is number => v !== null)
      row.push({
        formula: `AVERAGE(${columnLetter(firstCol)}${excelRow}:${columnLetter(firstCol + n - 1)}${excelRow})`,
        result: present.length ? present.reduce((a, b) => a + b, 0) / present.length : null,
      })
    })
    return row
  })

  return [header, ...rows]
}
