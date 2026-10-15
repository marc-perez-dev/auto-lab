// Parses the RheoML .xml files that TRIOS exports from the rheometer.

export type ExcelDate = { kind: 'date' | 'time'; serial: number }
export type RawCell = string | number | ExcelDate | null

/** One data point (one row of the measurement), keyed by XML tag name. */
export type Point = Record<string, number | undefined>

export interface Measurement {
  /** XML file name without the extension, used as the tab name. */
  fileName: string
  /** Lab folder the measurement was saved in (from RawDataFile). */
  sessionFolder: string
  sampleName: string
  /** ISO-ish "YYYY-MM-DDTHH:MM:SS", used to keep measurement order. */
  measuredAt: string
  /** Every row flattened like Excel's "open XML as table" does. */
  rawHeader: string[]
  rawRows: RawCell[][]
  points: Point[]
}

export class NotRheoMLError extends Error {}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{2}):(\d{2}):(\d{2})$/
const STATUS_MARKER = /\s*\((POR HACER|YA HECHO)\)\s*$/i

function toCell(text: string | null): RawCell {
  const value = (text ?? '').trim()
  if (value === '') return null
  if (NUMBER.test(value)) return Number(value)
  const date = DATE.exec(value)
  if (date) {
    const [, y, m, d] = date.map(Number)
    return { kind: 'date', serial: Date.UTC(y, m - 1, d) / 86_400_000 + 25_569 }
  }
  const time = TIME.exec(value)
  if (time) {
    const [, h, min, s] = time.map(Number)
    return { kind: 'time', serial: (h * 3600 + min * 60 + s) / 86_400 }
  }
  return value
}

function childElements(el: Element): Element[] {
  return Array.from(el.children)
}

/**
 * Builds the column list the way Excel names it when importing the XML:
 * a leaf element gives a column, then each of its attributes; repeated names
 * get a global counter appended (Comment2, unit3, Time4, unit5…).
 */
class ColumnNamer {
  private used = new Set<string>()
  private counter = 1

  name(tag: string): string {
    if (!this.used.has(tag)) {
      this.used.add(tag)
      return tag
    }
    this.counter += 1
    const renamed = `${tag}${this.counter}`
    this.used.add(renamed)
    return renamed
  }
}

type Field = { column: string; value: RawCell }

function flattenFixedPart(el: Element, namer: ColumnNamer, out: Field[]) {
  const children = childElements(el)
  if (children.length === 0) out.push({ column: namer.name(el.tagName), value: toCell(el.textContent) })
  for (const attr of Array.from(el.attributes)) {
    out.push({ column: namer.name(attr.name), value: toCell(attr.value) })
  }
  for (const child of children) flattenFixedPart(child, namer, out)
}

export function sessionFolderFrom(rawDataFile: string | null | undefined): string | null {
  const parts = (rawDataFile ?? '').trim().split(/[\\/]/).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : null
}

/** "2026-10-06 HAGel D1 N2 (POR HACER)" -> "2026-10-06 HAGel D1 N2" */
export function stripStatusMarker(folder: string): string {
  return folder.replace(STATUS_MARKER, '')
}

/**
 * @param fileName       name of the .xml file (with or without extension)
 * @param droppedFolder  folder the file came from, used only when the XML
 *                       does not say where it was saved
 */
export function parseRheoML(xmlText: string, fileName: string, droppedFolder?: string): Measurement {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const root = doc.documentElement
  if (doc.getElementsByTagName('parsererror').length > 0 || root.tagName !== 'RheoML_Dataset') {
    throw new NotRheoMLError(`${fileName} no es un archivo exportado del reómetro`)
  }

  const namer = new ColumnNamer()
  const fixed: Field[] = []
  const segments = childElements(root).filter((el) => el.tagName === 'ExperimentalData')
  for (const child of childElements(root)) {
    if (child.tagName !== 'ExperimentalData') flattenFixedPart(child, namer, fixed)
  }

  // Segment attributes (DataType, SegmentNumber) and point fields become
  // columns after the fixed part, in order of first appearance.
  const segmentAttrColumns = new Map<string, string>()
  const pointColumns = new Map<string, { value: string; attrs: string[]; attrColumns: string[] }>()
  for (const segment of segments) {
    for (const attr of Array.from(segment.attributes)) {
      if (!segmentAttrColumns.has(attr.name)) segmentAttrColumns.set(attr.name, namer.name(attr.name))
    }
  }
  for (const segment of segments) {
    for (const point of childElements(segment)) {
      for (const field of childElements(point)) {
        if (pointColumns.has(field.tagName)) continue
        const value = namer.name(field.tagName)
        const attrs = Array.from(field.attributes).map((a) => a.name)
        pointColumns.set(field.tagName, { value, attrs, attrColumns: attrs.map((a) => namer.name(a)) })
      }
    }
  }

  const rawHeader = [
    ...fixed.map((f) => f.column),
    ...segmentAttrColumns.values(),
    ...Array.from(pointColumns.values()).flatMap((c) => [c.value, ...c.attrColumns]),
  ]

  const rawRows: RawCell[][] = []
  const points: Point[] = []
  for (const segment of segments) {
    const segmentCells = Array.from(segmentAttrColumns.keys()).map((attr) => toCell(segment.getAttribute(attr)))
    for (const pointEl of childElements(segment)) {
      const byTag = new Map(childElements(pointEl).map((f) => [f.tagName, f]))
      const point: Point = {}
      const pointCells: RawCell[] = []
      for (const [tag, columns] of pointColumns) {
        const field = byTag.get(tag)
        const value = field ? toCell(field.textContent) : null
        if (typeof value === 'number') point[tag] = value
        pointCells.push(value)
        for (const attr of columns.attrs) pointCells.push(toCell(field?.getAttribute(attr) ?? null))
      }
      points.push(point)
      rawRows.push([...fixed.map((f) => f.value), ...segmentCells, ...pointCells])
    }
  }

  const text = (selector: string) => root.querySelector(selector)?.textContent?.trim() ?? ''
  const baseName = fileName.replace(/\.xml$/i, '')
  const folder = sessionFolderFrom(text('Source > RawDataFile')) ?? droppedFolder

  return {
    fileName: baseName,
    sessionFolder: folder ? stripStatusMarker(folder) : 'Reologia',
    sampleName: text('Sample > SampleName') || baseName,
    measuredAt: `${text('Source > Date')}T${text('Source > Time')}`,
    rawHeader,
    rawRows,
    points,
  }
}
