# EVENTIX — Manual Oficial de Identidad Visual de Marca (Brand Guidelines)

> **Versión:** 2.0 Oficial y Aprobada  
> **Concepto:** Orbit Ticket (Boleto Dinámico con Halo Orbital 3D y Destello Asteroide)  
> **Plataforma:** Eventix Bolivia (Venta de Entradas, Acceso QR y Manilla Cashless)  
> **Fecha:** Noviembre 2026

---

## 1. Racional del Concepto: "Orbit Ticket"

La identidad de Eventix sintetiza el mundo de la emoción en vivo y la tecnología de acceso en una metáfora visual inolvidable:

1. **El Boleto Dinámico (Ticket Token):**
   - El símbolo principal es un boleto de evento estilizado, inclinado a un ángulo áureo de **22°** hacia adelante, proyectando dinamismo y anticipación.
   - Cuenta con esquinas de radio continuo (*squircle*) y dos muescas semicirculares de precisión en los extremos cortos, homenajeando al boleto clásico y transformándolo en un activo digital.
2. **El Halo Orbital 3D (Velocidad y Flujo Continuo):**
   - Una elipse planetaria luminosa rodea el boleto en doble plano: el arco posterior pasa con menor opacidad por detrás del ticket, mientras que el arco frontal emerge con resplandor en **Cian Eléctrico (`#00F2FE`)** por encima, generando tridimensionalidad y profundidad real.
   - Simboliza la órbita de experiencias, el flujo constante de público en torniquetes y la conectividad inalámbrica NFC/RFID.
3. **El Destello Asteroide (La Chispa del Espectáculo):**
   - En el corazón del boleto brilla una estrella de 4 puntas de curvatura parabólica cóncava, representando la validación instantánea del código QR y el destello de los focos del escenario al comenzar el concierto.
4. **Tipografía Integrada (`Eventix`):**
   - Letras en cursiva aerodinámica a **13°** de inclinación.
   - El punto de la **"i"** es la misma estrella asteroide de 4 puntas, generando continuidad entre isotipo y logotipo.
   - El brazo superior derecho de la **"x"** se viste de **Azul Eléctrico (`#38BDF8`)** para cerrar la palabra con la misma energía del símbolo.

---

## 2. Paleta Cromática Institucional

| Muestra | Nombre | HEX | RGB | CMYK | Aplicación |
| :---: | :--- | :--- | :--- | :--- | :--- |
| ![#040714](https://via.placeholder.com/16/040714/000000?text=+) | **Space Obsidian** | `#040714` | `4, 7, 20` | `100, 85, 45, 80` | Fondo primordial de alto impacto, navbars y sidebars |
| ![#0B132B](https://via.placeholder.com/16/0B132B/000000?text=+) | **Deep Midnight** | `#0B132B` | `11, 19, 43` | `98, 80, 35, 60` | Superficies de interfaz, tarjetas y paneles |
| ![#1D4ED8](https://via.placeholder.com/16/1D4ED8/000000?text=+) | **Corporate Royal** | `#1D4ED8` | `29, 78, 216` | `90, 70, 0, 0` | Base del boleto, ancla visual de solvencia y confianza |
| ![#2563EB](https://via.placeholder.com/16/2563EB/000000?text=+) | **Electric Sapphire** | `#2563EB` | `37, 99, 235` | `82, 60, 0, 0` | Cuerpo del halo orbital y botones de acción |
| ![#38BDF8](https://via.placeholder.com/16/38BDF8/000000?text=+) | **Sky Azure** | `#38BDF8` | `56, 189, 248` | `65, 10, 0, 0` | Acento de la "x", borde superior del ticket |
| ![#00F2FE](https://via.placeholder.com/16/00F2FE/000000?text=+) | **Cyber Cyan** | `#00F2FE` | `0, 242, 254` | `60, 0, 10, 0` | Ápice del halo, estrella de la "i", resplandor |
| ![#FFFFFF](https://via.placeholder.com/16/FFFFFF/000000?text=+) | **Pure White** | `#FFFFFF` | `255, 255, 255` | `0, 0, 0, 0` | Destello central, tipografía en fondo oscuro |

---

## 3. Arquitectura del Sistema de Archivos

Los activos oficiales se encuentran organizados y sincronizados en el proyecto:

```
frontend/src/assets/brand/  y  frontend/public/brand/  y  assets/brand/
├── eventix-logo-horizontal-dark.svg    # Logotipo maestro para fondos oscuros (Navbars, app, banners)
├── eventix-logo-horizontal-light.svg   # Logotipo maestro para fondos blancos (Facturas, contratos, hojas membretadas)
├── eventix-logo-vertical-dark.svg      # Logotipo apilado / vertical para tótems y cartelería
├── eventix-logo-vertical-light.svg     # Logotipo apilado para papelería
├── eventix-symbol-orbit.svg            # Isotipo solo a todo color (Avatares, chips RFID, favicons)
├── eventix-symbol-white.svg            # Isotipo monocromo blanco para serigrafía y fondos de fotos
├── eventix-symbol-black.svg            # Isotipo monocromo negro (Sellos de agua y tickets térmicos POS)
├── eventix-wordmark-dark.svg           # Wordmark tipográfico solo
├── eventix-app-icon.svg                # Icono de app móvil (512x512)
├── eventix-logo-horizontal-dark.png    # Render PNG HD 1520x400
├── eventix-logo-horizontal-light.png   # Render PNG HD 1520x400
├── eventix-logo-vertical-dark.png      # Render PNG vertical 960x800
├── eventix-symbol-orbit.png            # Isotipo PNG HD 512x512
├── app-icon-512x512.png                # Icono para tiendas iOS / Android
└── favicon-32x32.png / 192x192.png     # Favicons oficiales del navegador
```

---

## 4. Uso del Componente `BrandLogo` en React

```jsx
import BrandLogo from '../components/BrandLogo'

// 1. Logotipo maestro horizontal en Navbar (modo oscuro predeterminado)
<BrandLogo to="/" imgClassName="h-9 w-auto" />

// 2. Logotipo maestro en fondo blanco (ej. Hoja de liquidación o factura)
<BrandLogo to={false} theme="light" imgClassName="h-10 w-auto" />

// 3. Isotipo solo (ej. avatar de perfil, barra móvil colapsada)
<BrandLogo variant="symbol" imgClassName="h-8 w-8" />

// 4. Versión vertical apilada (ej. póster o pantalla de inicio)
<BrandLogo variant="vertical" theme="dark" imgClassName="h-20 w-auto" />
```

---

## 5. Normas de Protección de Marca

- **No deformar:** Mantener siempre la relación de aspecto bloqueada (1:1 en escala).
- **No rotar:** El ángulo de 22° del boleto ya está calculado; no aplicar rotaciones adicionales al logotipo completo.
- **Área de seguridad:** Respetar un margen perimetral equivalente al 25% de la altura del símbolo antes de colocar textos o bordes ajenos.
- **Uso monocromo:** Para estampados a 1 sola tinta (ej. recibos de impresora térmica o serigrafía básica), utilizar `eventix-symbol-black.svg` o `eventix-symbol-white.svg`.
