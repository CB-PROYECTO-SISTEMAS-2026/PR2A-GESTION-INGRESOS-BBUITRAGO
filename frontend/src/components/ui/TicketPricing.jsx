import { priceRangeLabel } from '../../utils/format'

/** Resumen corto de precios. El detalle y la compra viven en el modal. */
export default function TicketPricing({ categorias = [], canBuy = false, onBuy }) {
  if (!categorias.length) {
    return <p className="text-sm text-muted">Sin categorías publicadas.</p>
  }

  const rango = priceRangeLabel({ categorias })

  return (
    <div className="ev-tickets">
      <h2 className="ev-section-title text-2xl text-balance">Entradas</h2>
      {rango && <p className="mt-3 text-pretty text-base font-medium text-ink">{rango}</p>}
      {canBuy && (
        <div className="mt-6">
          <button type="button" className="btn-primary" onClick={onBuy}>
            Comprar entrada
          </button>
        </div>
      )}
    </div>
  )
}
