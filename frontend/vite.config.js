import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const hostsLocales = new Set(['localhost', '127.0.0.1', '[::1]'])
const direccionesLocales = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

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
          const host = req.headers.host
          const indice = /^\/(\d+)$/.exec(req.url || '')?.[1]
          const cuenta = indice === undefined ? null : cuentas[Number(indice)]
          if (!cuenta || req.method !== 'POST' || !direccionesLocales.has(req.socket.remoteAddress)
              || !/^((localhost|127\.0\.0\.1)|\[::1\])(:\d+)?$/.test(host || '')
              || req.headers.origin !== 'http://' + host) {
            res.writeHead(403).end()
            return
          }
          try {
            const api = new URL(env.VITE_API_URL.replace(/\/$/, '') + '/auth/login')
            if (!hostsLocales.has(api.hostname)) throw new Error('API local requerida')
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
    server: { port: 5173 },
  }
})
