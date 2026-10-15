import { START_FREQUENCY_LABEL } from '../lib/session'

function SheetTabs({ tabs }: { tabs: string[] }) {
  return (
    <div aria-hidden className="mt-3 flex gap-1 overflow-hidden border-t border-stone-300 pt-2 text-xs">
      {tabs.map((tab, i) => (
        <span
          key={i}
          className={`rounded-b border border-t-0 px-2 py-0.5 whitespace-nowrap ${
            i === 0 ? 'border-stone-400 bg-stone-50 font-semibold text-stone-800' : 'border-stone-300 bg-stone-200 text-stone-500'
          }`}
        >
          {tab}
        </span>
      ))}
    </div>
  )
}

export function WhatYouGet() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Qué obtienes</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-300 bg-stone-50 p-4">
          <h3 className="font-bold">Excel completo</h3>
          <p className="text-stone-700">Una pestaña por medida, con todos los datos que da el reómetro.</p>
          <SheetTabs tabs={['Medida 1', 'Medida 2', 'Medida 3', '…']} />
        </div>
        <div className="rounded-lg border border-stone-300 bg-stone-50 p-4">
          <h3 className="font-bold">Excel de medias</h3>
          <p className="text-stone-700">
            Una pestaña por muestra, con G′ y G″ de cada réplica y su media, desde {START_FREQUENCY_LABEL}.
          </p>
          <SheetTabs tabs={['Muestra A', 'Muestra B', '…']} />
        </div>
      </div>
    </section>
  )
}
