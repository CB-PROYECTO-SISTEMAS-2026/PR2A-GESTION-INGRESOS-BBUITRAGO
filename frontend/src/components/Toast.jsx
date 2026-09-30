import { useEffect, useState } from 'react'

let pushToast = null
let nextId = 1

export function toast(message, type = 'info') {
  if (pushToast) pushToast({ message, type, id: nextId++ })
}

export function ToastHost() {
  const [items, setItems] = useState([])

  useEffect(() => {
    pushToast = (item) => {
      setItems((prev) => [...prev, item])
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id))
      }, 3500)
    }
    return () => {
      pushToast = null
    }
  }, [])

  if (!items.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={`toast ${t.type === 'error' ? 'border-l-red-600' : t.type === 'success' ? 'border-l-teal' : 'border-l-navy'}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
