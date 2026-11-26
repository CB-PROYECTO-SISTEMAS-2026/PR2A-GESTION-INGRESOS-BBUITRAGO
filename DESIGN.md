# Eventix — DESIGN.md

## Product truth

Eventix is a Bolivian ticketing and on-event wallet platform: published events, ticket purchase with bank QR + proof, digital QR entry, wristband (manilla) balance, POS, refunds, and organizer event requests. Copy and UI must describe only real flows; never invent metrics, testimonials, or fake inventory.

## Typography

- Sans UI: Plus Jakarta Sans
- Display: Outfit

## Color tokens (Corporate Royal — mandatory)

| Token | HEX | Use |
| --- | --- | --- |
| primary | `#1E40AF` | Primary buttons, active links, badges |
| primary-hover | `#1E3A8A` | Hover / pressed primary |
| primary-focus | `#3B82F6` | focus-visible rings |
| primary-soft | `#DBEAFE` | Category chips, selected rows |
| page | `#F8FAFC` | App canvas |
| surface | `#FFFFFF` | Cards, modals, forms |
| border | `#E2E8F0` | Borders, dividers |
| ink | `#0F172A` | Titles, prices, body |
| muted | `#64748B` | Dates, labels, placeholders |
| sidebar | `#0B132B` | Admin / staff chrome |
| sidebar-hover | `#162248` | Sidebar hover |
| sidebar-border | `#1E2C58` | Sidebar dividers |
| success | `#059669` | Valid QR / paid / published |
| success-soft | `#ECFDF5` | Success backgrounds |
| danger | `#DC2626` | Invalid QR / reject / destroy |
| danger-soft | `#FEF2F2` | Danger backgrounds |
| warning | `#D97706` | Low stock / pending |
| warning-soft | `#FFFBEB` | Warning backgrounds |
| info | `#0284C7` | Notices / policies |
| info-soft | `#F0F9FF` | Info backgrounds |

## Motion

- Marketing Home may use scroll reveal, counters, and one scroll-dissolve.
- Staff flows (POS, access, recharge, refunds) stay calm: no decorative parallax.
- Prefer short springs; avoid purple glow and bounce-everywhere.

## Content rules

- Home sections only show data from published events / APIs.
- FAQ describes real product behavior (purchase proof, QR, manilla, refund, event request).
- Contact uses `eventixeventos@gmail.com` via SMTP.
- Artist music only when `Evento.spotifyUrl` is set.

## Decision log

- 2026-11-24: Navbar is role-stable in-page home navigation; account/work links live only in the avatar menu.
- 2026-11-24: Client ticket purchase opens a modal; public detail shows only a short price range (no cupos). Payment QR asset: `IMGS/qr_pagos.jpeg` → `frontend/src/assets/qr_pagos.jpeg`.
- 2026-11-24: Third-party ticket assignment at checkout is email-only (backend no longer requires phone/name).
- 2026-11-26: Action feedback uses overlay toasts (`Toast` + `notifications-5`), not inline success/error labels that shift layout. Field errors stay under the input.
