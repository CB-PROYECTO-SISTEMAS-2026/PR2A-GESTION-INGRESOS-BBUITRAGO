import { useCallback, useEffect, useRef, useState } from 'react'

import { createPortal } from 'react-dom'

import { Link } from 'react-router-dom'

import BrandLogo from '../BrandLogo'

import ContactForm from './ContactForm'

import { CONTACT_CITY, CONTACT_EMAIL, CONTACT_PHONE } from '../../utils/contact'



const yearShort = String(new Date().getFullYear()).slice(-2)

const yearFull = new Date().getFullYear()



function FooterArrow() {

  return (

    <svg viewBox="0 0 24 24" fill="none" className="ev-footer-cta-icon" aria-hidden="true">

      <path

        d="M7 17L17 7M17 7H9M17 7V15"

        stroke="currentColor"

        strokeWidth="2.5"

        strokeLinecap="square"

        strokeLinejoin="miter"

      />

    </svg>

  )

}



function FooterContactOverlay({ open, onClose }) {

  useEffect(() => {

    if (!open) return undefined

    const prev = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const onKey = (e) => {

      if (e.key === 'Escape') onClose()

    }

    document.addEventListener('keydown', onKey)

    return () => {

      document.removeEventListener('keydown', onKey)

      document.body.style.overflow = prev

    }

  }, [open, onClose])



  if (!open) return null



  return createPortal(

    <div

      className="ev-footer-contact-layer fixed inset-0 z-[120] flex flex-col bg-sidebar text-primary-focus"

      role="dialog"

      aria-modal="true"

      aria-labelledby="ev-footer-contact-title"

    >

      <h2 id="ev-footer-contact-title" className="sr-only">

        Contacto Eventix

      </h2>

      <div className="flex items-start justify-end p-4 md:p-6">

        <button type="button" onClick={onClose} className="ev-footer-contact-close">

          Cerrar

        </button>

      </div>

      <div className="flex flex-1 flex-col justify-center overflow-y-auto px-4 pb-10 md:px-10 md:pb-16">

        <p className="ev-footer-lead max-w-2xl">

          Cuéntanos qué estás organizando y te respondemos al correo que dejes.

        </p>

        <ContactForm showHeading={false} variant="footer" className="mt-8 max-w-xl" />

      </div>

    </div>,

    document.body,

  )

}



function FooterScreen() {

  const footRef = useRef(null)

  const [contactOpen, setContactOpen] = useState(false)

  const openContact = useCallback(() => setContactOpen(true), [])

  const closeContact = useCallback(() => setContactOpen(false), [])



  useEffect(() => {

    const el = footRef.current

    if (!el) return undefined



    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')

    const show = () => el.classList.add('is-inview')



    if (reduceMq.matches) {

      show()

      return undefined

    }



    const obs = new IntersectionObserver(

      ([entry]) => {

        if (!entry?.isIntersecting) return

        show()

        obs.disconnect()

      },

      { threshold: 0.2, rootMargin: '0px 0px -5% 0px' },

    )

    obs.observe(el)



    const onChange = () => {

      if (reduceMq.matches) show()

    }

    reduceMq.addEventListener('change', onChange)



    return () => {

      obs.disconnect()

      reduceMq.removeEventListener('change', onChange)

    }

  }, [])



  return (

    <>

      <footer ref={footRef} className="ev-footer ev-footer--screen" id="ev-footer">

        <div className="ev-footer-bg" aria-hidden="true">

          <BrandLogo to={false} variant="symbol" theme="white" imgClassName="ev-footer-watermark-img" />

        </div>



        <div className="ev-footer-inner">

          <div className="ev-footer-rule" aria-hidden="true" />


          <div className="ev-footer-top ev-footer-rise ev-footer-rise--1">

            <p className="ev-footer-headline">Hablemos de tu evento.</p>

            <p className="ev-footer-year" aria-hidden="true">

              ©{yearShort}

            </p>

          </div>



          <div className="ev-footer-mid">

            <p className="ev-footer-lead ev-footer-rise ev-footer-rise--2">

              Escríbenos para publicar tu evento en Eventix.

            </p>

            <button type="button" className="ev-footer-cta ev-footer-rise ev-footer-rise--3" onClick={openContact}>

              <span className="ev-footer-cta-label">Contáctanos</span>

              <span className="ev-footer-cta-arrow">

                <FooterArrow />

              </span>

            </button>

          </div>



          <div className="ev-footer-bottom ev-footer-rise ev-footer-rise--4">
            <div className="ev-footer-bottom-bar">
              <BrandLogo to="/" variant="symbol" theme="white" imgClassName="ev-footer-brand-mark" />
              <nav className="ev-footer-legal-nav" aria-label="Enlaces del pie de página">
                <Link to="/" className="ev-footer-link">
                  Inicio
                </Link>
                <Link to="/eventos" className="ev-footer-link">
                  Explorar eventos
                </Link>
                <a href={`mailto:${CONTACT_EMAIL}?subject=Soporte%20Eventix`} className="ev-footer-link">
                  Soporte
                </a>
              </nav>
              <div className="ev-footer-address">
                <p>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="ev-footer-link">
                    {CONTACT_EMAIL}
                  </a>
                </p>
                <p>
                  <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="ev-footer-link">
                    {CONTACT_PHONE}
                  </a>
                </p>
                <p>{CONTACT_CITY}</p>
              </div>
              <p className="ev-footer-copy">Todos los derechos reservados ©{yearFull}</p>
            </div>
          </div>

        </div>

      </footer>



      <FooterContactOverlay open={contactOpen} onClose={closeContact} />

    </>

  )

}



function FooterCompact() {

  return (

    <footer className="mt-auto border-t border-border bg-surface px-4 py-4 text-center text-xs text-muted">

      © {yearFull} Eventix · {CONTACT_CITY}

    </footer>

  )

}



export default function Footer({ variant = 'screen' }) {

  if (variant === 'compact') return <FooterCompact />

  return <FooterScreen />

}
