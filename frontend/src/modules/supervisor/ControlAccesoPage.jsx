import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  getAforoSupervisor,
  getMisEventosAcceso,
  rechazarAcceso,
  registrarAcceso,
  verificarAcceso,
  verificarDocumento,
} from '../../api/acceso.api'
import FotoCaptura from '../../components/acceso/FotoCaptura'
import QrScanner from '../../components/acceso/QrScanner'
import { toast } from '../../components/Toast'
import HojaEvento from '../../components/terminal/HojaEvento'
import MarcoEscaner from '../../components/terminal/MarcoEscaner'
import TarjetaLectura from '../../components/terminal/TarjetaLectura'
import { leerAjustesLector } from '../../components/terminal/lectorPrefs'
import { IconQr, IconWarning } from '../../components/ui/icons'
import { formatDay, getErrorMessage } from '../../utils/format'
import { formatNumber } from '../../utils/validation'

const EVENTO_KEY = 'eventix_evento_acceso'
const AFORO_REFRESH_MS = 15_000

function lineaFuncion(evento) {
  if (evento?.hoy) {
    const hora = evento.hoy.horaInicio ? ` · ${evento.hoy.horaInicio}` : ''
    return `${formatDay(evento.hoy.fecha, { weekday: 'short', day: 'numeric', month: 'short' })}${hora}`
  }
  return evento?.proximo ? `Próximo: ${formatDay(evento.proximo)}` : ''
}

function fichaPersona(resultado, codigo) {
  return {
    nombre: resultado?.persona?.nombre || null,
    codigo: resultado?.entrada?.codigo || codigo,
    extra: resultado?.entrada?.categoria || null,
  }
}

/** Puerta del encargado: escanear, documento, foto y recién ahí el ingreso queda registrado. */
export default function ControlAccesoPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [eventos, setEventos] = useState(null)
  const [eventoId, setEventoId] = useState(() => sessionStorage.getItem(EVENTO_KEY) || '')
  const [sentido, setSentido] = useState('ENTRADA')
  const [paso, setPaso] = useState('inicio')
  const [hoja, setHoja] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [documentSuffix, setDocumentSuffix] = useState('')
  const [foto, setFoto] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [aforo, setAforo] = useState(null)
  const panelReq = useRef(0)
  const busyRef = useRef(false)
  const ultimaRef = useRef({ codigo: '', at: 0 })

  useEffect(() => {
    let alive = true
    getMisEventosAcceso()
      .then(({ data }) => {
        if (!alive) return
        const lista = data.eventos ?? []
        setEventos(lista)
        setEventoId((actual) => {
          if (lista.some((e) => e.id === actual)) return actual
          const deHoy = lista.filter((e) => e.hoy)
          return deHoy.length === 1 ? deHoy[0].id : ''
        })
      })
      .catch((err) => alive && setError(getErrorMessage(err, 'No se pudieron cargar tus eventos.')))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (eventoId) sessionStorage.setItem(EVENTO_KEY, eventoId)
    else sessionStorage.removeItem(EVENTO_KEY)
  }, [eventoId])

  const evento = eventos?.find((e) => e.id === eventoId) ?? null
  const operativo = Boolean(evento?.hoy)

  const cargarPanel = useCallback(async () => {
    if (!eventoId) return
    const n = ++panelReq.current
    try {
      const { data } = await getAforoSupervisor(eventoId)
      if (n !== panelReq.current) return
      setAforo(data)
    } catch {
      /* El aforo anterior sigue en pantalla si el refresco falla. */
    }
  }, [eventoId])

  useEffect(() => {
    if (!operativo) return undefined
    cargarPanel()
    const timer = setInterval(() => cargarPanel(), AFORO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [operativo, cargarPanel])

  const irAlInicio = useCallback(() => {
    setPaso('inicio')
    setAviso(null)
    setResultado(null)
    setCodigo('')
    setFoto(null)
    setDocumentSuffix('')
    setManual('')
    busyRef.current = false
  }, [])

  const irAlLector = useCallback(() => {
    setPaso('lector')
    setAviso(null)
    setResultado(null)
    setCodigo('')
    setFoto(null)
    setDocumentSuffix('')
    setManual('')
    busyRef.current = false
  }, [])

  useEffect(() => {
    if (!location.state?.openLector) return
    if (operativo) irAlLector()
    navigate('.', { replace: true, state: {} })
  }, [location.state?.openLector, operativo, irAlLector, navigate])

  useEffect(() => {
    if (paso !== 'aviso' || !aviso) return undefined
    const prefs = leerAjustesLector()
    if (aviso.tono === 'success' && prefs.tapOnSuccess) return undefined
    if (aviso.tono !== 'success' && prefs.holdOnFail) return undefined
    const timer = setTimeout(irAlLector, prefs.successMs)
    return () => clearTimeout(timer)
  }, [paso, aviso, irAlLector])

  const mostrarAviso = (tarjeta) => {
    if (navigator.vibrate) navigator.vibrate(tarjeta.tono === 'success' ? 80 : [80, 60, 80])
    setAviso(tarjeta)
    setPaso('aviso')
  }

  const leer = async (valor) => {
    const texto = valor.trim()
    if (!texto || busyRef.current || !operativo) return
    const prefs = leerAjustesLector()
    const ahora = Date.now()
    if (ultimaRef.current.codigo === texto && ahora - ultimaRef.current.at < prefs.ignoreMs) return
    ultimaRef.current = { codigo: texto, at: ahora }
    busyRef.current = true
    setVerificando(true)
    try {
      const { data } = await verificarAcceso({ eventoId, codigo: texto, sentido })
      setCodigo(texto)
      setResultado(data)
      setFoto(null)
      setDocumentSuffix('')
      if (data.estado === 'VALIDO' && sentido === 'SALIDA') {
        const registrado = await registrarAcceso({ eventoId, codigo: texto, sentido: 'SALIDA' })
        setAforo(registrado.data.aforo)
        mostrarAviso({
          tono: 'success',
          titulo: 'Salida registrada',
          ...fichaPersona(data, texto),
        })
        return
      }
      if (data.estado === 'VALIDO') {
        setPaso('documento')
        return
      }
      mostrarAviso({
        tono: data.severidad === 'grave' ? 'danger' : 'warning',
        titulo: data.motivo || 'No se puede pasar',
        ...fichaPersona(data, texto),
      })
    } catch (err) {
      ultimaRef.current = { codigo: '', at: 0 }
      toast(getErrorMessage(err), 'error')
    } finally {
      setVerificando(false)
      busyRef.current = false
    }
  }

  const comprobarDocumento = async () => {
    const suffix = documentSuffix.trim()
    if (!/^[A-Za-z0-9]{4}$/.test(suffix)) {
      toast('Ingresa exactamente los últimos 4 caracteres del documento.', 'error')
      return
    }
    setRegistrando(true)
    try {
      const { data } = await verificarDocumento({
        eventoId,
        codigo,
        sentido,
        documentSuffix: suffix,
      })
      if (!data.coincidio) {
        mostrarAviso({
          tono: 'danger',
          titulo: 'Documento rechazado',
          motivo: data.mensaje,
          ...fichaPersona(resultado, codigo),
        })
        return
      }
      setPaso('foto')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setRegistrando(false)
    }
  }

  const completarIngreso = async () => {
    if (resultado?.requiereFoto && !foto) return
    setRegistrando(true)
    try {
      const { data } = await registrarAcceso({
        eventoId,
        codigo,
        sentido: 'ENTRADA',
        foto: resultado.requiereFoto ? foto : null,
        fotoVerificada: Boolean(resultado.fotoIngreso),
        documentSuffix: documentSuffix.trim(),
      })
      setAforo(data.aforo)
      mostrarAviso({
        tono: 'success',
        titulo: 'Acceso validado',
        ...fichaPersona(resultado, codigo),
      })
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setRegistrando(false)
    }
  }

  const rechazarFoto = async () => {
    setRegistrando(true)
    try {
      await rechazarAcceso({ eventoId, codigo, sentido: 'ENTRADA' })
      mostrarAviso({
        tono: 'danger',
        titulo: 'No es la misma persona',
        motivo: 'La persona no coincide con la foto del primer ingreso.',
        ...fichaPersona(resultado, codigo),
      })
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setRegistrando(false)
    }
  }

  const elegirEvento = (id) => {
    setEventoId(id)
    setAforo(null)
    setHoja(false)
    irAlInicio()
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {!eventos && !error && (
        <p className="text-sm text-muted" role="status">
          Cargando…
        </p>
      )}
      {eventos && !eventos.length && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="font-semibold text-ink">No tienes eventos asignados</p>
          <p className="mt-1 text-sm text-muted">El administrador debe asignarte al control de acceso de un evento publicado.</p>
        </div>
      )}

      {paso === 'inicio' && eventos?.length > 0 && (
        <>
          <section className="rounded-xl border border-border border-l-4 border-l-primary bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Evento</p>
            {evento ? (
              <>
                <p className="mt-1 font-display text-lg font-bold text-ink">{evento.titulo}</p>
                <p className="mt-1 text-sm text-muted">{lineaFuncion(evento)}</p>
              </>
            ) : (
              <p className="mt-1 font-semibold text-ink">Elige el evento de esta puerta</p>
            )}
            <button type="button" className="mt-3 text-sm font-semibold text-primary" onClick={() => setHoja(true)}>
              Cambiar
            </button>
          </section>

          {evento && !operativo && (
            <div className="flex gap-3 rounded-xl border border-warning bg-warning-soft p-3 text-sm text-ink">
              <IconWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p>Este evento no se realiza hoy. Podrás controlar el acceso el {lineaFuncion(evento).replace('Próximo: ', '')}.</p>
            </div>
          )}

          {operativo && (
            <p className="text-sm text-muted" role="status">
              {aforo
                ? `${formatNumber(aforo.dentro)} dentro${aforo.capacidad ? ` / ${formatNumber(aforo.capacidad)}` : ''} · ${formatNumber(aforo.entradasDelDia)} entradas del día`
                : 'Cargando aforo…'}
            </p>
          )}

          {operativo && (
            <div className="inline-flex rounded-md border border-border bg-page p-1" role="group" aria-label="Sentido del paso">
              {[
                ['ENTRADA', 'Entrada'],
                ['SALIDA', 'Salida'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={sentido === value}
                  className={`rounded px-4 py-2 text-sm font-semibold ${
                    sentido === value ? 'bg-primary text-white' : 'text-muted'
                  }`}
                  onClick={() => setSentido(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {operativo && (
            <button type="button" className="btn-primary w-full" onClick={irAlLector}>
              <IconQr className="h-5 w-5" /> Lector QR
            </button>
          )}

          <div className="text-sm font-semibold">
            <Link to="/supervisor/historial-accesos" className="text-primary">
              Historial
            </Link>
          </div>
        </>
      )}

      {paso === 'lector' && operativo && (
        <>
          <div className="flex items-center justify-between">
            <button type="button" className="text-sm font-semibold text-primary" onClick={irAlInicio}>
              Inicio
            </button>
            <p className="text-sm font-semibold text-ink">{sentido === 'ENTRADA' ? 'Entrada' : 'Salida'}</p>
          </div>
          <MarcoEscaner>
            <QrScanner active={!verificando} onDetect={leer} />
          </MarcoEscaner>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              leer(manual)
            }}
            className="flex gap-2"
          >
            <input
              className="input font-mono"
              value={manual}
              maxLength={191}
              autoComplete="off"
              placeholder="Código de la manilla o del QR"
              aria-label="Código escaneado"
              onChange={(e) => setManual(e.target.value)}
            />
            <button type="submit" className="btn-secondary shrink-0" disabled={verificando || manual.trim().length < 3}>
              {verificando ? '…' : 'Leer'}
            </button>
          </form>
        </>
      )}

      {paso === 'documento' && resultado && (
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-ink">{resultado.persona?.nombre || 'Sin titular'}</p>
            <p className="font-mono text-xs text-muted">{resultado.entrada?.codigo}</p>
            <p className="mt-1 text-xs text-muted">{resultado.entrada?.categoria}</p>
          </div>
          <div>
            <label className="label" htmlFor="document-suffix">
              Últimos 4 caracteres del documento
            </label>
            <input
              id="document-suffix"
              className="input font-mono uppercase tracking-widest"
              value={documentSuffix}
              maxLength={4}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setDocumentSuffix(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))}
            />
            <p className="mt-2 text-xs text-muted">La entrada sigue sin usar hasta sacar la foto.</p>
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={documentSuffix.trim().length !== 4 || registrando}
            onClick={comprobarDocumento}
          >
            {registrando ? 'Comprobando…' : 'Comprobar documento'}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={irAlLector} disabled={registrando}>
            Cancelar
          </button>
        </section>
      )}

      {paso === 'foto' && resultado && (
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold text-ink">{resultado.persona?.nombre || 'Sin titular'}</p>
            <p className="font-mono text-xs text-muted">{resultado.entrada?.codigo}</p>
          </div>
          {resultado.fotoIngreso ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Foto del primer ingreso</p>
              <img
                src={resultado.fotoIngreso.url}
                alt="Foto del primer ingreso"
                className="aspect-video w-full rounded-xl border border-border bg-ink object-contain"
              />
              <button type="button" className="btn-primary w-full" onClick={completarIngreso} disabled={registrando}>
                {registrando ? 'Registrando…' : 'Es la misma persona'}
              </button>
              <button type="button" className="btn-secondary w-full !text-danger" onClick={rechazarFoto} disabled={registrando}>
                No es la misma persona
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Foto de la persona</p>
              <FotoCaptura value={foto} onChange={setFoto} />
              <button type="button" className="btn-primary w-full" onClick={completarIngreso} disabled={!foto || registrando}>
                {registrando ? 'Registrando…' : 'Completar ingreso'}
              </button>
            </>
          )}
          <button type="button" className="btn-secondary w-full" onClick={irAlLector} disabled={registrando}>
            Cancelar
          </button>
        </section>
      )}

      {paso === 'aviso' && aviso && (
        <section className="space-y-4">
          <TarjetaLectura
            tono={aviso.tono}
            titulo={aviso.titulo}
            motivo={aviso.motivo}
            nombre={aviso.nombre}
            codigo={aviso.codigo}
            extra={aviso.extra}
          />
          <button type="button" className="btn-primary w-full" onClick={irAlLector}>
            Seguir escaneando
          </button>
        </section>
      )}

      <HojaEvento
        key={hoja ? 'abierta' : 'cerrada'}
        abierto={hoja}
        eventos={eventos ?? []}
        seleccionadoId={eventoId}
        descripcion={lineaFuncion}
        onElegir={elegirEvento}
        onCerrar={() => setHoja(false)}
      />
    </div>
  )
}
