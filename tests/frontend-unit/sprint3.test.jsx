import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import api from '../../frontend/src/api/axios'
import Reportes from '../../frontend/src/modules/sprint3/Reportes'
import HistorialAccesos from '../../frontend/src/modules/sprint3/HistorialAccesos'
import Reembolsos from '../../frontend/src/modules/sprint3/Reembolsos'
import { Comprobante, HistorialDevoluciones } from '../../frontend/src/modules/sprint3/Devoluciones'

vi.mock('../../frontend/src/api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())

it('conserva la clave cuando el organizador reintenta una incidencia del mismo evento', async () => {
  const user = userEvent.setup()
  api.get.mockImplementation(async (url) => ({
    data: url.includes('/incidencias')
      ? []
      : {
          evento: { titulo: 'Festival' },
          cantidadEventos: 1,
          entradas: { bruto: 40, ingresoNeto: 35, reembolsos: 5, compras: 1 },
          negocios: { total: 8, ventas: 1 },
          accesos: {},
          movimientos: [],
          saldos: [],
          operadores: [],
        },
  }))
  api.post.mockRejectedValueOnce(new Error('Conexión interrumpida')).mockResolvedValue({})
  render(
    <MemoryRouter initialEntries={['/evento/e1']}>
      <Routes>
        <Route path="/evento/:id" element={<Reportes />} />
      </Routes>
    </MemoryRouter>,
  )
  await user.type(await screen.findByLabelText('Descripción'), 'Puerta cerrada')
  await user.click(screen.getByText('Reportar incidencia'))
  await screen.findByRole('alert')
  await user.click(screen.getByText('Reportar incidencia'))
  expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0])
  expect(api.post.mock.calls[0][0]).toBe('/reportes/evento/e1/incidencias')
})

it('solicita devolución de la entrada elegida y vuelve al historial', async () => {
  api.get.mockResolvedValue({ data: [] })
  api.post.mockResolvedValue({})
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/mis-reembolsos?entrada=t1']}>
      <Reembolsos />
    </MemoryRouter>,
  )
  await user.type(screen.getByLabelText('Motivo de devolución'), 'Cambio de fecha')
  await user.click(screen.getByText('Solicitar reembolso'))
  await screen.findByText('Solicitud registrada.')
  expect(api.post).toHaveBeenCalledWith('/entradas/t1/reembolso', { motivo: 'Cambio de fecha' })
  expect(screen.queryByLabelText('Motivo de devolución')).toBeNull()
})

it('sube una foto vinculada a la transacción confirmada', async () => {
  api.post.mockResolvedValue({})
  const user = userEvent.setup()
  render(<Comprobante id="t1" />)
  await user.upload(
    screen.getByLabelText(/Foto del comprobante/),
    new File(['foto'], 'foto.png', { type: 'image/png' }),
  )
  await user.click(screen.getByText('Guardar comprobante'))
  await screen.findByText('Comprobante guardado.')
  expect(api.post.mock.calls[0][0]).toBe('/devoluciones/t1/comprobante')
  expect(api.post.mock.calls[0][1].get('foto').name).toBe('foto.png')
})

it('pagina las devoluciones del encargado dentro del evento seleccionado', async () => {
  api.get.mockImplementation(async (url) => ({
    data: url.endsWith('/contexto')
      ? { eventos: [{ id: 'e1', titulo: 'Festival' }] }
      : { devoluciones: [], cantidad: 51, pageSize: 50 },
  }))
  const user = userEvent.setup()
  render(<HistorialDevoluciones />)
  await user.click(await screen.findByText('Siguiente'))
  await waitFor(() =>
    expect(api.get).toHaveBeenCalledWith('/historiales/devoluciones?eventoId=e1&page=2', expect.anything()),
  )
})

it('permite consultar registros anteriores al límite y vuelve a la primera página al cambiar de fecha', async () => {
  const fechas = [{ id: 'd1', fecha: '2026-11-15' }, { id: 'd2', fecha: '2026-11-16' }]
  api.get.mockImplementation(async (url) => ({
    data: url.endsWith('mis-eventos')
      ? { eventos: [{ id: 'e1', titulo: 'Feria', fechas }] }
      : { fechaId: 'd1', pageSize: 200, registros: [], total: 201 },
  }))
  const user = userEvent.setup()
  render(<HistorialAccesos />)
  await user.click(await screen.findByRole('button', { name: 'Siguiente' }))
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/acceso/eventos/e1/registros?page=2', expect.anything()))
  await user.selectOptions(screen.getByLabelText('Fecha'), 'd2')
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/acceso/eventos/e1/registros?fechaId=d2&page=1', expect.anything()))
})
