# Reología → Excel

Página web que convierte los `.xml` que exporta TRIOS (reómetro de TA Instruments) en dos Excel:

- **`<carpeta>.xlsx`**: una pestaña por medida con todos sus datos, igual que al abrir el XML en Excel como tabla.
- **`<carpeta> average.xlsx`**: una pestaña por muestra con G' (`StorageModulus`) y G'' (`LossModulus`) de cada réplica y su media (`=AVERAGE`). Solo se usan las filas a partir de la primera a 0,1 Hz.

Los archivos se procesan en el navegador; no se suben a ningún sitio.

## Uso

1. En TRIOS, exporta cada medida a `.xml`.
2. Abre la página y arrastra la carpeta del ensayo (los `.tri` se ignoran).
3. Descarga los dos Excel. Se llaman como la carpeta donde TRIOS guardó las medidas.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # tests con datos inventados
npm run build
```

Para comprobar contra datos reales (no se guardan en el repo), apunta `REAL_DATA_DIR` a una carpeta con `INPUT/<carpetas de ensayo>` y `OUTPUT/REO DIA 1.xlsx` + `OUTPUT/REO DIA 1 average.xlsx`:

```bash
REAL_DATA_DIR=/ruta/a/Marc npm test
```

## Publicación

Cada push a `main` se despliega en GitHub Pages con `.github/workflows/deploy.yml`. En el repo de GitHub: *Settings → Pages → Source: GitHub Actions*. Si el repo no se llama `auto-lab`, cambia `base` en `vite.config.ts`.
