import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)
ScrollTrigger.register(gsap)

export { gsap, useGSAP, ScrollTrigger }
