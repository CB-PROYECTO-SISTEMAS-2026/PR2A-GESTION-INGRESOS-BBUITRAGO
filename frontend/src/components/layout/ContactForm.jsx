import { useState } from 'react'
import { enviarContacto } from '../../api/contacto.api'
import { toast } from '../Toast'
import { getErrorMessage } from '../../utils/format'

export default function ContactForm({ className = '', showHeading = true, variant = 'default' }) {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await enviarContacto({ email, mensaje })
      toast({
        title: 'Mensaje enviado',
        body: 'Te respondemos al correo que dejaste.',
        variant: 'success',
      })
      setEmail('')
      setMensaje('')
    } catch (err) {
      toast({
        title: 'No se pudo enviar',
        body: getErrorMessage(err, 'Intenta de nuevo en un momento.'),
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const isFooter = variant === 'footer'

  return (
    <form
      className={`ev-contact-form ${isFooter ? 'ev-contact-form--footer' : ''} ${className}`}
      onSubmit={onSubmit}
      noValidate={false}
    >
      {showHeading && (
        <>
          <h3 className="font-display text-2xl font-semibold text-white text-balance md:text-3xl">
            ¿Quieres promocionar tu evento?
          </h3>
          <p className="mt-2 text-sm text-slate-400">Cuéntanos qué estás organizando.</p>
        </>
      )}
      <label className={`${showHeading ? 'mt-8' : 'mt-0'} block text-xs uppercase tracking-wider text-slate-400`} htmlFor="contact-email">
        Correo
        <input
          id="contact-email"
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={
            isFooter
              ? 'mt-2 w-full border-0 border-b border-sidebar-border bg-transparent px-0 py-3 text-base text-white outline-none focus:border-primary'
              : 'mt-1 w-full rounded-md border border-sidebar-border bg-sidebar-hover px-3 py-2 text-sm text-white'
          }
          placeholder=""
          autoComplete="email"
          spellCheck={false}
        />
      </label>
      <label className="mt-6 block text-xs uppercase tracking-wider text-slate-400" htmlFor="contact-mensaje">
        Cuéntanos sobre tu evento
        <textarea
          id="contact-mensaje"
          name="mensaje"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          className={
            isFooter
              ? 'mt-2 w-full border-0 border-b border-sidebar-border bg-transparent px-0 py-3 text-base text-white outline-none focus:border-primary'
              : 'mt-1 w-full rounded-md border border-sidebar-border bg-sidebar-hover px-3 py-2 text-sm text-white'
          }
          placeholder=""
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className={
          isFooter
            ? 'ev-footer-cta ev-footer-submit mt-8 flex w-full items-center justify-center disabled:opacity-60'
            : 'btn-primary mt-3 !py-2 !text-sm disabled:opacity-60'
        }
      >
        {busy ? 'Enviando…' : 'Enviar mensaje'}
      </button>
    </form>
  )
}
