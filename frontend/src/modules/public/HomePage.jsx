import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublishedEvents } from '../../api/events.api'
import EventCard from '../../components/EventCard'
import { useAuth } from '../../context/AuthContext'
import { eventDayRange, eventImage, getErrorMessage } from '../../utils/format'

function quickLinksFor(roles) {
  if (!roles) {
    return [
      { to: '/eventos', title: 'Eventos', text: 'Mira todos los eventos disponibles.' },
      { to: '/register', title: 'Crear cuenta', text: 'Regístrate para comprar tus entradas.' },
      { to: '/login', title: 'Iniciar sesión', text: 'Ingresa con tu correo y contraseña.' },
    ]
  }
  if (roles.includes('ADMIN')) {
    return [
      { to: '/admin/solicitudes', title: 'Solicitudes', text: 'Revisa las solicitudes de evento.' },
      { to: '/admin/eventos', title: 'Eventos', text: 'Administra los eventos y sus entradas.' },
      { to: '/admin/usuarios', title: 'Usuarios', text: 'Consulta e invita usuarios.' },
    ]
  }
  if (roles.includes('ORGANIZADOR')) {
    return [
      { to: '/organizador/solicitudes', title: 'Mis solicitudes', text: 'Sigue el estado de tus solicitudes.' },
      { to: '/organizador/nueva-solicitud', title: 'Nueva solicitud', text: 'Propón un nuevo evento.' },
      { to: '/perfil', title: 'Mi perfil', text: 'Actualiza tus datos personales.' },
    ]
  }
  if (roles.includes('JEFE_NEGOCIO')) {
    return [
      { to: '/negocio', title: 'Mis negocios', text: 'Administra tus puestos en los eventos.' },
      { to: '/negocio/productos', title: 'Productos', text: 'Gestiona tus productos y precios.' },
      { to: '/perfil', title: 'Mi perfil', text: 'Actualiza tus datos personales.' },
    ]
  }
  return [
    { to: '/eventos', title: 'Eventos', text: 'Mira todos los eventos disponibles.' },
    { to: '/perfil', title: 'Mi perfil', text: 'Actualiza tus datos personales.' },
  ]
}

export default function HomePage() {
  const { user, isAuthenticated } = useAuth()
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await getPublishedEvents()
        const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
        if (alive) setEvents(list)
      } catch (err) {
        if (alive) setError(getErrorMessage(err, 'No se pudieron cargar los eventos'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (events.length < 2) return undefined
    const timer = setInterval(() => {
      setSlide((s) => (s + 1) % events.length)
    }, 5500)
    return () => clearInterval(timer)
  }, [events.length])

  const displayName = user?.nombre || 'usuario'
  const headline = isAuthenticated ? `Hola, ${displayName}` : 'Bienvenido a EvenTix'
  const subline = isAuthenticated
    ? 'Estos son los próximos eventos publicados.'
    : 'Encuentra los próximos eventos y sus entradas.'

  const current = events[slide] || null
  const featuredImg = current ? eventImage(current) : null

  const go = (dir) => {
    if (!events.length) return
    setSlide((s) => (s + dir + events.length) % events.length)
  }

  const quickLinks = quickLinksFor(isAuthenticated ? user?.roles ?? [] : null)

  return (
    <div>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 md:pb-14 md:pt-12">
          <div className="max-w-xl">
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">{headline}</h1>
            <p className="mt-3 max-w-md text-sm text-slate-300 md:text-base">{subline}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/eventos" className="btn-primary">
                Explorar eventos
              </Link>
              <Link
                to={isAuthenticated ? '/perfil' : '/login'}
                className="rounded-md border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {isAuthenticated ? 'Mi perfil' : 'Iniciar sesión'}
              </Link>
            </div>
          </div>

          <div className="relative mt-10 overflow-hidden rounded-md border border-white/10 bg-navy-2">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">
                Eventos destacados
              </p>
              {events.length > 0 && (
                <p className="text-xs text-slate-400">
                  {slide + 1} / {events.length}
                </p>
              )}
            </div>

            {loading ? (
              <div className="grid min-h-[280px] place-items-center p-10 text-sm text-slate-400 md:min-h-[340px]">
                Cargando eventos…
              </div>
            ) : current ? (
              <div className="relative">
                <div className="grid md:grid-cols-2">
                  <div className="relative min-h-[220px] md:min-h-[340px]">
                    <img src={featuredImg} alt={current.titulo} className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center gap-4 p-6 md:p-8">
                    <h2 className="font-display text-2xl font-bold md:text-3xl">{current.titulo}</h2>
                    <p className="line-clamp-4 text-sm leading-relaxed text-slate-300">
                      {current.descripcion || 'Sin descripción'}
                    </p>
                    <p className="text-sm text-slate-400">
                      {eventDayRange(current)}
                      {current.ubicacion ? ` · ${current.ubicacion}` : ''}
                    </p>
                    <div>
                      <Link to={`/eventos/${current.id}`} className="btn-primary !text-sm">
                        Ver evento
                      </Link>
                    </div>
                  </div>
                </div>

                {events.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Anterior"
                      onClick={() => go(-1)}
                      className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 px-3 py-2 text-lg font-bold text-navy shadow"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      aria-label="Siguiente"
                      onClick={() => go(1)}
                      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 px-3 py-2 text-lg font-bold text-navy shadow"
                    >
                      ›
                    </button>
                    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                      {events.map((e, i) => (
                        <button
                          key={e.id}
                          type="button"
                          aria-label={`Ir al evento ${i + 1}`}
                          onClick={() => setSlide(i)}
                          className={`h-2.5 w-2.5 rounded-full transition ${
                            i === slide ? 'bg-teal' : 'bg-white/40 hover:bg-white/70'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="grid min-h-[280px] place-items-center p-10 text-center md:min-h-[340px]">
                <p className="font-display text-xl font-semibold text-white">Muy pronto habrá nuevos eventos</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display text-xl font-semibold">Accesos rápidos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
          {quickLinks.map((q) => (
            <Link key={q.to} to={q.to} className="card-surface p-5 transition hover:border-teal hover:shadow-sm">
              <p className="font-semibold text-ink">{q.title}</p>
              <p className="mt-1 text-sm text-muted">{q.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Eventos disponibles</h2>
          <Link to="/eventos" className="text-sm font-semibold text-teal hover:underline">
            Ver todos
          </Link>
        </div>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="text-muted">Cargando eventos…</p>
        ) : events.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 6).map((e) => (
              <EventCard key={e.id} evento={e} />
            ))}
          </div>
        ) : (
          <p className="card-surface p-6 text-sm text-muted">Por ahora no hay eventos publicados.</p>
        )}
      </section>
    </div>
  )
}
