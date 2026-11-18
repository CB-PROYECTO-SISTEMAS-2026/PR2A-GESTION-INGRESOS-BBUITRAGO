import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { getErrorMessage } from '../../utils/format'

export function useDatos(url) {
  const [version, recargar] = useState(0)
  const [result, guardar] = useState({})
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    api
      .get(url, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) guardar({ url, version, data })
      })
      .catch((e) => {
        if (!controller.signal.aborted) guardar({ url, version, error: getErrorMessage(e) })
      })
    return () => controller.abort()
  }, [url, version])
  return {
    ...(result.url === url && result.version === version ? result : {}),
    refresh: () => recargar((v) => v + 1),
  }
}

export function Aviso({ error }) {
  return error ? (
    <p role="alert" className="rounded-md bg-red-50 p-3 text-red-800">
      {error}
    </p>
  ) : null
}

export function Paginas({ page, onChange, mas }) {
  if (page === 1 && !mas) return null
  return (
    <nav aria-label="Páginas" className="flex items-center gap-4">
      <button className="btn-secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span>Página {page}</span>
      <button className="btn-secondary" disabled={!mas} onClick={() => onChange(page + 1)}>
        Siguiente
      </button>
    </nav>
  )
}

export function Tabla({ titulo, columnas, filas }) {
  return (
    <section className="card-surface p-4">
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      {filas.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {columnas.map((c) => (
                  <th className="px-2 py-2" key={c}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr className="border-t border-border" key={i}>
                  {fila.map((v, j) => (
                    <td className="px-2 py-2" key={j}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">Sin registros.</p>
      )}
    </section>
  )
}
