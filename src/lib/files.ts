// Collects the files she drops or picks, remembering the folder each came from.

import { NotRheoMLError, parseRheoML, type Measurement } from './rheoml'
import { buildSessions, type Session } from './session'

export interface PickedFile {
  file: File
  /** Name of the folder that contains the file, if known. */
  folder?: string
}

export interface ProcessResult {
  sessions: Session[]
  /** .xml files that could not be read, with the reason. */
  rejected: { name: string; reason: string }[]
}

function readFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

async function readDirectory(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dir.createReader()
  const all: FileSystemEntry[] = []
  // readEntries returns results in batches until it returns an empty one.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
    if (batch.length === 0) return all
    all.push(...batch)
  }
}

async function collectEntry(entry: FileSystemEntry, folder?: string): Promise<PickedFile[]> {
  if (entry.isFile) return [{ file: await readFileEntry(entry as FileSystemFileEntry), folder }]
  if (!entry.isDirectory) return []
  const children = await readDirectory(entry as FileSystemDirectoryEntry)
  return (await Promise.all(children.map((child) => collectEntry(child, entry.name)))).flat()
}

export async function filesFromDrop(dataTransfer: DataTransfer): Promise<PickedFile[]> {
  // Entries must be taken synchronously, before the drop event ends.
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry())
    .filter((e): e is FileSystemEntry => e !== null)
  if (entries.length === 0) return Array.from(dataTransfer.files).map((file) => ({ file }))
  return (await Promise.all(entries.map((e) => collectEntry(e)))).flat()
}

export function filesFromInput(list: FileList): PickedFile[] {
  return Array.from(list).map((file) => {
    const parts = file.webkitRelativePath.split('/')
    return { file, folder: parts.length >= 2 ? parts[parts.length - 2] : undefined }
  })
}

export async function processFiles(picked: PickedFile[]): Promise<ProcessResult> {
  // Anything else (e.g. the .tri originals) is not needed.
  const xmls = picked.filter(({ file }) => file.name.toLowerCase().endsWith('.xml'))
  const measurements: Measurement[] = []
  const rejected: ProcessResult['rejected'] = []

  for (const { file, folder } of xmls) {
    try {
      measurements.push(parseRheoML(await file.text(), file.name, folder))
    } catch (error) {
      const reason = error instanceof NotRheoMLError ? 'no es un archivo exportado del reómetro' : 'no se ha podido leer'
      rejected.push({ name: file.name, reason })
    }
  }

  return { sessions: buildSessions(measurements), rejected }
}
