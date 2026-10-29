// Collects the files she drops or picks, remembering the folder each came from.

import { NotRheoMLError, parseRheoML, sessionFolderFrom, type Measurement } from './rheoml'
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
  // Entries and files must be taken synchronously, before the drop event ends.
  const dropped = Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry() ?? item.getAsFile())
  const picked = await Promise.all(
    dropped.map((d) => (d === null ? [] : d instanceof File ? [{ file: d }] : collectEntry(d))),
  )
  return picked.flat()
}

export function filesFromInput(list: FileList): PickedFile[] {
  return Array.from(list).map((file) => ({ file, folder: sessionFolderFrom(file.webkitRelativePath) ?? undefined }))
}

export async function processFiles(picked: PickedFile[]): Promise<ProcessResult> {
  // Anything else (e.g. the .tri originals) is not needed.
  const xmls = picked.filter(({ file }) => file.name.toLowerCase().endsWith('.xml'))
  const parsed = await Promise.all(
    xmls.map(async ({ file, folder }) => {
      try {
        return parseRheoML(await file.text(), file.name, folder)
      } catch (error) {
        const reason = error instanceof NotRheoMLError ? 'no es un archivo exportado del reómetro' : 'no se ha podido leer'
        return { name: file.name, reason }
      }
    }),
  )
  const measurements = parsed.filter((p): p is Measurement => 'segments' in p)
  const rejected = parsed.filter((p): p is ProcessResult['rejected'][number] => 'reason' in p)
  return { sessions: buildSessions(measurements), rejected }
}
