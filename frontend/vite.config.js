import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const hostsApiLocales = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Loopback o LAN privada: PC y celular en la misma red Wi‑Fi. */
function esClienteDev(addr = '') {
  const ip = addr.replace(/^::ffff:/, '')
  if (ip === '127.0.0.1' || ip === '::1') return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip)) return true
  const m = /^172\.(\d{1,3})\./.exec(ip)
  if (m) {
    const segundo = Number(m[1])
    return segundo >= 16 && segundo <= 31
  }
  return false
}

/** Host de Vite en PC (localhost) o en celular (IP LAN). */
function esHostDev(host = '') {
  const h = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true
  return esClienteDev(h)
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), ['EVENTIX_PRESENTACION', 'VITE_API_URL'])
  const cuentas = command === 'serve' && mode === 'development'
    ? JSON.parse(env.EVENTIX_PRESENTACION || '[]')
    : []

  return {
    plugins: [react(), tailwindcss(), {
      name: 'acceso-presentacion-local',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/presentacion/sesion', async (req, res) => {
          res.setHeader('Cache-Control', 'no-store')
          const host = req.headers.host || ''
          const origen = req.headers.origin || ''
          const indice = /^\/(\d+)$/.exec(req.url || '')?.[1]
          const cuenta = indice === undefined ? null : cuentas[Number(indice)]
          if (
            !cuenta ||
            req.method !== 'POST' ||
            !esClienteDev(req.socket.remoteAddress || '') ||
            !esHostDev(host) ||
            (origen !== `http://${host}` && origen !== `https://${host}`)
          ) {
            res.writeHead(403).end()
            return
          }
          try {
            // En el browser /api va por el proxy de Vite; aquí hace falta URL absoluta a Nest.
            const baseApi = env.VITE_API_URL?.startsWith('http')
              ? env.VITE_API_URL.replace(/\/$/, '')
              : 'http://127.0.0.1:3000/api'
            const api = new URL(`${baseApi}/auth/login`)
            if (!hostsApiLocales.has(api.hostname)) throw new Error('API local requerida')
            const respuesta = await fetch(api, {
              method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cuenta.email, password: cuenta.password }),
            })
            res.setHeader('Content-Type', 'application/json')
            res.writeHead(respuesta.status).end(await respuesta.text())
          } catch {
            if (!res.headersSent) res.writeHead(503)
            res.end()
          }
        })
      },
    }],
    define: { 'import.meta.env.EVENTIX_ROLES_DEMO': JSON.stringify(cuentas.map(cuenta => cuenta.label)) },
    resolve: { dedupe: ['gsap'] },
    optimizeDeps: { include: ['gsap', 'gsap/ScrollTrigger', '@gsap/react'] },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
