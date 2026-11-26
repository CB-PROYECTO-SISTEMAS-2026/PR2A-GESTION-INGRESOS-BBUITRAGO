const STORAGE_KEY = 'eventix_visitor_key'

export function getEventSearchVisitorKey() {
  try {
    let key = localStorage.getItem(STORAGE_KEY)
    if (!key) {
      key = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, key)
    }
    return key
  } catch {
    return null
  }
}