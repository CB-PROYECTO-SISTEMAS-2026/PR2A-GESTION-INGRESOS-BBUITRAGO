const MAX = 6

function key(userId, scope) {
  return `eventix_mis_${scope}_q:${userId || 'anon'}`
}

function readMisListRecent(userId, scope) {
  try {
    const raw = localStorage.getItem(key(userId, scope))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string' && s.trim()).slice(0, MAX) : []
  } catch {
    return []
  }
}

function pushMisListRecent(userId, termino, scope) {
  const t = termino.replace(/\s+/g, ' ').trim()
  if (t.length < 2) return readMisListRecent(userId, scope)
  const lower = t.toLowerCase()
  const prev = readMisListRecent(userId, scope).filter((s) => s.toLowerCase() !== lower)
  const next = [t, ...prev].slice(0, MAX)
  try {
    localStorage.setItem(key(userId, scope), JSON.stringify(next))
  } catch {
    /* quota */
  }
  return next
}

export function readMisEntradasRecent(userId) {
  return readMisListRecent(userId, 'entradas')
}

export function pushMisEntradasRecent(userId, termino) {
  return pushMisListRecent(userId, termino, 'entradas')
}

export function readMisComprasRecent(userId) {
  return readMisListRecent(userId, 'compras')
}

export function pushMisComprasRecent(userId, termino) {
  return pushMisListRecent(userId, termino, 'compras')
}