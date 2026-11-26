import { useId, useState } from 'react'

const DEFAULT_ITEMS = [
  {
    q: '¿Cómo compro una entrada?',
    a: 'Elige el evento, selecciona la categoría y la cantidad, paga con el QR bancario del organizador y sube el comprobante. Cuando Eventix confirma el pago, tus entradas quedan en Mis entradas.',
  },
  {
    q: '¿Dónde veo mi código QR?',
    a: 'En Mis entradas. Toca la tarjeta para revelar el QR, ampliarlo o descargarlo. Lo presentas en el acceso del evento.',
  },
  {
    q: '¿Qué es la manilla?',
    a: 'Es el saldo del evento vinculado a tu entrada. Puedes recargarlo en el punto de recargas y usarlo en los negocios del recinto.',
  },
  {
    q: '¿Cómo solicito un reembolso?',
    a: 'Desde Mis reembolsos, si el evento aún está dentro del plazo de reembolso configurado. El equipo de Eventix revisa la solicitud.',
  },
  {
    q: '¿Cómo propongo un evento como organizador?',
    a: 'Con rol organizador, envía una solicitud (no se publica sola). El administrador la revisa y, si la aprueba, el evento se prepara en Eventix.',
  },
  {
    q: '¿Cómo contactan las promotoras a Eventix?',
    a: 'Usa el formulario del pie de página: deja tu correo y un mensaje. Te respondemos al correo que indiques.',
  },
]

export default function FaqAccordion({ items = DEFAULT_ITEMS, title = 'Preguntas frecuentes', className = '' }) {
  const [open, setOpen] = useState(null)
  const baseId = useId()

  return (
    <section className={`ev-faq ${className}`}>
      <h2 className="ev-section-title text-balance text-center md:text-left">{title}</h2>
      <ul className="mx-auto mt-8 flex max-w-3xl flex-col gap-3">
        {items.map((item, i) => {
          const isOpen = open === i
          const panelId = `${baseId}-panel-${i}`
          const buttonId = `${baseId}-button-${i}`

          return (
            <li
              key={item.q}
              className={`ev-faq-item ${isOpen ? 'is-open' : ''}`}
            >
              <button
                id={buttonId}
                type="button"
                className="ev-faq-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="min-w-0 flex-1 text-left font-semibold text-ink text-pretty">
                  {item.q}
                </span>
                <span className={`ev-faq-toggle ${isOpen ? 'is-open' : ''}`} aria-hidden="true">
                  <span className="ev-faq-toggle-bar ev-faq-toggle-h" />
                  <span className="ev-faq-toggle-bar ev-faq-toggle-v" />
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className={`ev-faq-panel ${isOpen ? 'is-open' : ''}`}
              >
                <div className="ev-faq-panel-inner">
                  <p className="ev-faq-answer">{item.a}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}