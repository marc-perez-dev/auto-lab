import { useState } from 'react'
import type { Session } from '../lib/session'

type Kind = 'raw' | 'average'

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function SessionCard({ session }: { session: Session }) {
  const [busy, setBusy] = useState<Kind | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download(kind: Kind) {
    setBusy(kind)
    setError(null)
    try {
      const wb = await import('../lib/workbooks')
      const workbook = kind === 'raw' ? wb.buildRawWorkbook(session) : wb.buildAverageWorkbook(session)
      saveBlob(await wb.toBlob(workbook), kind === 'raw' ? wb.rawFileName(session) : wb.averageFileName(session))
    } catch (e) {
      console.error(e)
      setError('No se ha podido crear el Excel. Recarga la página y vuelve a intentarlo.')
    } finally {
      setBusy(null)
    }
  }

  const sampleCount = session.samples.length
  const measurementCount = session.measurements.length

  return (
    <section className="card flex flex-col gap-5">
      <header>
        <h2 className="text-xl font-bold break-words">{session.folder}</h2>
        <p className="text-stone-600">
          {measurementCount} {measurementCount === 1 ? 'medida' : 'medidas'} · {sampleCount}{' '}
          {sampleCount === 1 ? 'muestra' : 'muestras'}
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-stone-200">
        {session.samples.map((sample) => (
          <li key={sample.name} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
            <span className="font-semibold sm:w-48 sm:shrink-0">{sample.name}</span>
            <span className="flex flex-wrap gap-1.5">
              {sample.replicates.map((r) => (
                <span key={r.measurement.fileName} className="rounded bg-stone-200 px-2 py-0.5 text-sm text-stone-800">
                  {r.measurement.fileName}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>

      {session.warnings.length > 0 && (
        <div className="rounded-md border-l-4 border-amber-600 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="font-semibold">Revisa esto:</p>
          <ul className="list-disc pl-5">
            {session.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-primary flex-col" disabled={busy !== null} onClick={() => download('raw')}>
          <span>{busy === 'raw' ? 'Creando…' : 'Descargar Excel completo'}</span>
          <span className="text-xs font-normal opacity-80 break-all">{session.folder}.xlsx</span>
        </button>
        <button type="button" className="btn-primary flex-col" disabled={busy !== null} onClick={() => download('average')}>
          <span>{busy === 'average' ? 'Creando…' : 'Descargar Excel de medias'}</span>
          <span className="text-xs font-normal opacity-80 break-all">{session.folder} average.xlsx</span>
        </button>
      </div>
      {error && <p className="text-red-700">{error}</p>}
    </section>
  )
}
