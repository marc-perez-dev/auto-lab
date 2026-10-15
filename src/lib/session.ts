// Groups measurements into lab sessions and samples, and lays out the
// averages sheet of each sample.

import type { Measurement, Point } from './rheoml'

/** Rows before the first one at this frequency are ignored for averages. */
export const START_FREQUENCY_HZ = 0.1
export const START_FREQUENCY_LABEL = `${String(START_FREQUENCY_HZ).replace('.', ',')} Hz`

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

// Sweep points are ~26% apart, so 0.01% only absorbs rounding in the export.
const sameFrequency = (a: number | undefined, b: number | undefined) =>
  a !== undefined && b !== undefined && Math.abs(a - b) <= 1e-4 * Math.abs(b)

/** Sample names that differ only in case or spacing are the same sample. */
const sampleKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

export const rawFileName = (session: Session) => `${session.folder}.xlsx`
export const averageFileName = (session: Session) => `${session.folder} average.xlsx`

export function rowsFromStartFrequency(points: Point[]): Point[] | null {
  const start = points.findIndex((p) => sameFrequency(p[FREQUENCY], START_FREQUENCY_HZ))
  return start === -1 ? null : points.slice(start)
}

/**
 * Excel tab names: max 31 chars, no : \ / ? * [ ], no leading or trailing
 * apostrophe, not "History", unique ignoring case.
 */
export function excelSheetNames(names: string[]): string[] {
  const used = new Set<string>(['history'])
  return names.map((name) => {
    const base = name.replace(/[:\\/?*[\]]/g, '_').slice(0, 31).replace(/^'+|'+$/g, '') || 'Hoja'
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
    name === sheetNames[i]
      ? []
      : [
          `La pestaña de ${what} «${name}» se llama «${sheetNames[i]}» porque Excel no admite ese nombre o ya hay otra pestaña que se llama igual.`,
        ],
  )
}

const byMeasuredAt = (a: Measurement, b: Measurement) =>
  a.measuredAt.localeCompare(b.measuredAt) || a.fileName.localeCompare(b.fileName)

const FULL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

/** The same run exported twice has the same sample and start time: keep one. */
function withoutDuplicateExports(ordered: Measurement[], warnings: string[]): Measurement[] {
  const seen = new Map<string, Measurement>()
  return ordered.filter((m) => {
    if (!FULL_TIMESTAMP.test(m.measuredAt)) return true
    const key = `${sampleKey(m.sampleName)}|${m.measuredAt}`
    const first = seen.get(key)
    if (!first) {
      seen.set(key, m)
      return true
    }
    warnings.push(
      `«${m.fileName}» es la misma medida que «${first.fileName}» (exportada dos veces): solo se usa «${first.fileName}».`,
    )
    return false
  })
}

function buildSession(folder: string, measurements: Measurement[]): Session {
  const warnings: string[] = []
  const ordered = withoutDuplicateExports([...measurements].sort(byMeasuredAt), warnings)

  const rawNames = ordered.map((m) => m.fileName)
  const rawSheetNames = excelSheetNames(rawNames)
  warnings.push(...renameWarnings(rawNames, rawSheetNames, 'la medida'))

  const bySample = new Map<string, { name: string; replicates: Replicate[] }>()
  for (const measurement of ordered) {
    const rows = rowsFromStartFrequency(measurement.points)
    if (!rows) {
      warnings.push(
        `«${measurement.fileName}» no tiene ninguna fila a ${START_FREQUENCY_LABEL}: está en el Excel completo pero no en el de medias.`,
      )
      continue
    }
    const key = sampleKey(measurement.sampleName)
    const group = bySample.get(key) ?? { name: measurement.sampleName, replicates: [] }
    group.replicates.push({ measurement, rows })
    bySample.set(key, group)
  }

  const groups = [...bySample.values()]
  const sampleNames = groups.map((g) => g.name)
  const sampleSheetNames = excelSheetNames(sampleNames)
  warnings.push(...renameWarnings(sampleNames, sampleSheetNames, 'la muestra'))

  const samples = groups.map((g, i) => ({ ...g, sheetName: sampleSheetNames[i] }))
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
  for (const m of measurements) {
    const group = byFolder.get(m.sessionFolder)
    if (group) group.push(m)
    else byFolder.set(m.sessionFolder, [m])
  }
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
