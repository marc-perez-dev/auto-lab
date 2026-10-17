const link = 'underline decoration-stone-400 underline-offset-2 hover:text-stone-900 hover:decoration-stone-900'

export function Footer() {
  return (
    <footer className="border-t border-stone-300 px-4 py-6 text-sm text-stone-600 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>Hecho por Marc Pérez Roig</p>
        {/* New tab for GitHub, so leaving the page doesn't lose the Excel results on screen. */}
        <nav aria-label="Contacto" className="flex flex-wrap gap-x-4 gap-y-1">
          <a className={link} href="mailto:marc@berial.es">
            marc@berial.es
          </a>
          <a className={link} href="https://github.com/marc-perez-dev" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className={link} href="https://github.com/sponsors/marc-perez-dev" target="_blank" rel="noreferrer">
            Apoya el proyecto
          </a>
        </nav>
      </div>
    </footer>
  )
}
