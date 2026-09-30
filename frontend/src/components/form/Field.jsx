export default function Field({ label, htmlFor, error, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

export function Section({ title, children, actions }) {
  return (
    <section className="card-surface p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}
