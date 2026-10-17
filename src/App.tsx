import { useEffect, useRef, useState } from 'react'
import { DropZone } from './components/DropZone'
import { Footer } from './components/Footer'
import { SessionCard } from './components/SessionCard'
import { WhatYouGet } from './components/WhatYouGet'
import { processFiles, type PickedFile, type ProcessResult } from './lib/files'

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error' } | { kind: 'done'; result: ProcessResult }

export default function App() {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const busy = useRef(false)

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

  async function onFiles(files: Promise<PickedFile[]>) {
    if (busy.current) return
    busy.current = true
    setState({ kind: 'busy' })
    try {
      setState({ kind: 'done', result: await processFiles(await files) })
    } catch (e) {
      console.error(e)
      setState({ kind: 'error' })
    } finally {
      busy.current = false
    }
  }

  const result = state.kind === 'done' ? state.result : null

  return (
    <div className="flex min-h-screen flex-col bg-stone-100 text-stone-900 selection:bg-stone-200">
      <header className="border-b-2 border-stone-900 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold">Reología → Excel</h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        {result === null ? (
          <>
            <p className="text-lg">
              Arrastra la carpeta de un ensayo y descarga sus dos Excel: uno con todas las medidas y otro con las medias de
              cada muestra.
            </p>
            {state.kind === 'error' && (
              <p className="rounded-md border-l-4 border-red-700 bg-red-50 px-4 py-3 text-red-900">
                No se han podido leer los archivos. Vuelve a intentarlo.
              </p>
            )}
            <DropZone onFiles={onFiles} busy={state.kind === 'busy'} />
            <WhatYouGet />
            <p className="text-sm text-stone-600">Los archivos no se suben a internet: todo ocurre en tu ordenador.</p>
          </>
        ) : (
          <>
            {result.sessions.length === 0 && (
              <p className="card">No hay ningún .xml del reómetro en lo que has arrastrado. Expórtalos primero desde TRIOS.</p>
            )}
            {result.sessions.map((session) => (
              <SessionCard key={session.folder} session={session} />
            ))}
            {result.rejected.length > 0 && (
              <div className="rounded-md border-l-4 border-red-700 bg-red-50 px-4 py-3 text-red-900">
                <p className="font-semibold">No se han podido usar estos archivos:</p>
                <ul className="list-disc pl-5">
                  {result.rejected.map((r, i) => (
                    <li key={i}>
                      {r.name}: {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" className="btn-secondary self-start" onClick={() => setState({ kind: 'idle' })}>
              Convertir otra carpeta
            </button>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
