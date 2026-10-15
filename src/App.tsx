import { useEffect, useState } from 'react'
import { DropZone } from './components/DropZone'
import { SessionCard } from './components/SessionCard'
import { processFiles, type PickedFile, type ProcessResult } from './lib/files'
import { START_FREQUENCY_HZ } from './lib/session'

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; result: ProcessResult }

const hz = String(START_FREQUENCY_HZ).replace('.', ',')

export default function App() {
  const [state, setState] = useState<State>({ kind: 'idle' })

  // Dropping a file outside the drop zone must not make the browser open it.
  useEffect(() => {
    const block = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  async function onFiles(files: PickedFile[]) {
    setState({ kind: 'busy' })
    setState({ kind: 'done', result: await processFiles(files) })
  }

  const result = state.kind === 'done' ? state.result : null

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 selection:bg-stone-200">
      <header className="border-b-2 border-stone-900 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold">Reología → Excel</h1>
          <p className="text-stone-600">Convierte los .xml del reómetro en el Excel completo y el Excel de medias.</p>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        {result === null ? (
          <>
            <DropZone onFiles={onFiles} busy={state.kind === 'busy'} />
            <ol className="list-decimal space-y-1 pl-5 text-stone-700">
              <li>En TRIOS, exporta cada medida a .xml, como siempre.</li>
              <li>Arrastra aquí la carpeta del ensayo. Los .tri no molestan, se ignoran.</li>
              <li>Descarga los dos Excel. Se llaman como la carpeta, sin «(POR HACER)».</li>
            </ol>
            <p className="text-sm text-stone-600">
              Para las medias solo se usan las filas desde {hz} Hz; todo lo anterior se ignora. Los archivos no salen de
              tu ordenador: todo se hace en el navegador.
            </p>
          </>
        ) : (
          <>
            {result.sessions.length === 0 && (
              <p className="card">No he encontrado ningún .xml del reómetro. ¿Has exportado las medidas desde TRIOS?</p>
            )}
            {result.sessions.map((session) => (
              <SessionCard key={session.folder} session={session} />
            ))}
            {result.rejected.length > 0 && (
              <div className="rounded-md border-l-4 border-red-700 bg-red-50 px-4 py-3 text-red-900">
                <p className="font-semibold">No se han podido usar estos archivos:</p>
                <ul className="list-disc pl-5">
                  {result.rejected.map((r) => (
                    <li key={r.name}>
                      {r.name}: {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" className="btn-secondary self-start" onClick={() => setState({ kind: 'idle' })}>
              Procesar otra carpeta
            </button>
          </>
        )}
      </main>
    </div>
  )
}
