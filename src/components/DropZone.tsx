import { useRef, useState, type ChangeEvent } from 'react'
import { filesFromDrop, filesFromInput, type PickedFile } from '../lib/files'

interface Props {
  /** Receives a promise because walking a dropped folder takes a while. */
  onFiles: (files: Promise<PickedFile[]>) => void
  busy: boolean
}

export function DropZone({ onFiles, busy }: Props) {
  const [over, setOver] = useState(false)
  const folderInput = useRef<HTMLInputElement | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const onPicked = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles(Promise.resolve(filesFromInput(e.target.files)))
    e.target.value = ''
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (!busy) onFiles(filesFromDrop(e.dataTransfer))
      }}
      className={`flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
        over ? 'border-earth-green bg-stone-200' : 'border-stone-400 bg-stone-50'
      }`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-12 w-12 fill-none stroke-stone-500" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h9A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5m0-5-2 2m2-2 2 2" />
      </svg>
      <div>
        <p className="text-lg font-semibold">{busy ? 'Leyendo archivos…' : 'Arrastra aquí la carpeta del ensayo'}</p>
        <p className="text-stone-600">o los archivos .xml sueltos</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => folderInput.current?.click()}>
          Elegir carpeta
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
          Elegir archivos .xml
        </button>
      </div>
      <input
        ref={(el) => {
          folderInput.current = el
          el?.setAttribute('webkitdirectory', '')
        }}
        type="file"
        hidden
        onChange={onPicked}
      />
      <input ref={fileInput} type="file" accept=".xml" multiple hidden onChange={onPicked} />
    </div>
  )
}
