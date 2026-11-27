import { useEffect, useState } from 'react'
import { useSlideOver } from '../../hooks/useSlideOver'
import { IconChevronLeft } from '../ui/icons'
import { guardarAjustesLector, leerAjustesLector } from './lectorPrefs'

const SUCCESS_STEPS = [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000]
const IGNORE_STEPS = [5000, 10000, 15000, 20000, 30000, 45000, 60000]

function labelSegundos(ms) {
  const s = ms / 1000
  return s === 1 ? '1 segundo' : `${s} segundos`
}

function snapIndex(steps, value) {
  let best = 0
  let diff = Infinity
  steps.forEach((v, i) => {
    const d = Math.abs(v - value)
    if (d < diff) {
      diff = d
      best = i
    }
  })
  return best
}

function Toggle({ checked, onChange, label, description, id }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p id={id} className="text-sm font-semibold text-ink">
          {label}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-border'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function LectorRange({ label, valueLabel, min, max, value, onChange, steps }) {
  const index = snapIndex(steps, value)
  const pct = steps.length <= 1 ? 0 : (index / (steps.length - 1)) * 100

  return (
    <div className="py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <span className="shrink-0 text-sm font-semibold text-primary">{valueLabel}</span>
      </div>
      <input
        type="range"
        className="ev-lector-range mt-3 w-full"
        style={{ '--ev-range-pct': `${pct}%` }}
        min={min}
        max={max}
        step={1}
        value={index}
        aria-valuetext={valueLabel}
        onChange={(e) => onChange(steps[Number(e.target.value)])}
      />
    </div>
  )
}

/** Configuración del lector QR (pantalla completa en el marco de la terminal). */
export default function AjustesLector({ abierto, onCerrar, embedded = true }) {
  const { mounted, active } = useSlideOver(abierto)
  const [prefs, setPrefs] = useState(() => leerAjustesLector())

  useEffect(() => {
    if (abierto) setPrefs(leerAjustesLector())
  }, [abierto])

  const shellClass = embedded ? 'absolute inset-0 z-[60]' : 'fixed inset-0 z-50'

  const patch = (parcial) => {
    const next = guardarAjustesLector(parcial)
    setPrefs(next)
  }

  if (!mounted) return null

  return (
    <div className={`${shellClass} overflow-hidden`} role="presentation">
      <button
        type="button"
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Cerrar configuración"
        onClick={onCerrar}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-xl transition-transform duration-300 ease-out ${
          active ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ajustes-lector-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-border px-4 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-page"
              aria-label="Volver"
              onClick={onCerrar}
            >
              <IconChevronLeft className="h-5 w-5" />
            </button>
            <h1 id="ajustes-lector-titulo" className="flex-1 text-center font-display text-lg font-bold text-ink">
              Configuración
            </h1>
            <span className="w-10" aria-hidden="true" />
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            Estos ajustes se guardan por separado para cada lector.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <div className="mt-4 flex rounded-xl bg-page p-1" role="tablist" aria-label="Tipo de lector">
            {[
              ['NFC', false],
              ['QR', true],
              ['Láser', false],
            ].map(([label, enabled]) => (
              <span
                key={label}
                role="tab"
                aria-selected={enabled}
                aria-disabled={!enabled}
                className={`flex-1 rounded-lg py-2.5 text-center text-sm font-semibold ${
                  enabled
                    ? 'border border-primary bg-surface text-primary shadow-sm'
                    : 'text-muted opacity-60'
                }`}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="mt-2 divide-y divide-border">
            <Toggle
              id="tap-on-success"
              label="Tocar para continuar"
              description="Si está activo, la pantalla de resultado permanece tras cada lectura y debes tocarla para escanear de nuevo. Si está inactivo (modo rápido), se reanuda automáticamente."
              checked={prefs.tapOnSuccess}
              onChange={(v) => patch({ tapOnSuccess: v })}
            />
            <Toggle
              id="tap-on-fail"
              label="Tocar para continuar si falla"
              description="Si está activo, cuando una lectura no es exitosa la pantalla de estado permanece hasta que la toques (aunque el modo sea rápido). Útil para no perder de vista los rechazos."
              checked={prefs.holdOnFail}
              onChange={(v) => patch({ holdOnFail: v })}
            />
          </div>

          <LectorRange
            label="Tiempo de pantalla de estado"
            valueLabel={labelSegundos(prefs.successMs)}
            min={0}
            max={SUCCESS_STEPS.length - 1}
            value={prefs.successMs}
            steps={SUCCESS_STEPS}
            onChange={(successMs) => patch({ successMs })}
          />
          <LectorRange
            label="Ignorar relecturas del mismo ticket"
            valueLabel={labelSegundos(prefs.ignoreMs)}
            min={0}
            max={IGNORE_STEPS.length - 1}
            value={prefs.ignoreMs}
            steps={IGNORE_STEPS}
            onChange={(ignoreMs) => patch({ ignoreMs })}
          />
        </div>
      </div>
    </div>
  )
}