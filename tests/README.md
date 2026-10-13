# Pruebas automatizadas de Eventix

Esta carpeta contiene las pruebas automatizadas del proyecto. Es independiente del backend y del frontend: tiene su propio `package.json`, pero prueba **el código real** de `backend/src` y `frontend/src`, usando las mismas librerías instaladas en `backend/node_modules` y `frontend/node_modules`.

## Cómo ejecutarlas

Requisitos previos (una sola vez):

```bash
cd backend && npm install     # el backend debe tener sus dependencias y el cliente de Prisma
cd ../frontend && npm install # el frontend debe tener sus dependencias (React, React Router)
cd ../tests && npm install    # instala Jest, Vitest, Playwright y TypeScript para las pruebas
```

Comandos (siempre desde la carpeta `tests/`):

| Comando | Qué hace |
|---|---|
| `npm test` | Unitarias del backend, del frontend y luego las de integración (~5 min) |
| `npm run test:unit` | Solo las unitarias (~1 s, no necesitan base de datos ni servidor) |
| `npm run test:integracion` | Solo las de integración (usan la base compartida, una tras otra) |
| `npm run test:watch` | Modo vigilancia: vuelve a correr las unitarias cada vez que guardas un archivo |
| `npm run test:frontend` | Solo las unitarias del frontend (~6 s, Vitest) |
| `npm run test:frontend:watch` | Las del frontend en modo vigilancia |
| `npx jest unit/pos-dates.test.ts` | Corre un solo archivo unitario |
| `npx jest --runInBand integracion/pos-cobro` | Corre un solo archivo de integración |
| `npx jest -t "medianoche"` | Corre solo las pruebas cuyo nombre contiene ese texto |
| `npm run test:e2e` | Pruebas en navegador (Playwright, ~4 min; levanta backend y frontend si no están corriendo) |
| `npm run test:e2e:ver` | Las mismas, con el navegador visible para mirar lo que hacen |
| `npm run test:e2e:reporte` | Abre el informe de la última ejecución e2e (pasos, capturas, red) |
| `npm run test:todo` | Todo: unitarias (backend y frontend) + integración + e2e (~9 min) |
| `npm run limpiar` | Muestra los datos de prueba que hay en la base (no borra nada) |
| `npm run limpiar:confirmar` | Borra los datos de prueba (solo los marcados `[PRUEBA-AUTO]`) |

## Cómo leer el resultado

- `✓` = la regla se cumple; `✕` = falló.
- En un fallo, Jest muestra lo esperado (**Expected**) y lo obtenido (**Received**), y la línea exacta.
- Cada archivo empieza con un bloque que explica **qué verifica, por qué importa, qué código prueba, cómo ejecutarlo y qué hacer si falla**. Léelo antes de cambiar una prueba.
- Si una prueba falla después de un cambio **intencional** en el código, actualiza la prueba. Si el cambio no era intencional, la prueba acaba de encontrar un error.

## Pruebas disponibles

Ordenadas por prioridad (ver el plan completo más abajo).

### 1. Unitarias (`unit/`): no usan base de datos, servidor ni internet

| Archivo | Qué protege |
|---|---|
| `unit/pos-dates.test.ts` | Horario del evento (márgenes y eventos que cruzan la medianoche) y rangos de fechas en hora de La Paz |
| `unit/pos-helpers.test.ts` | Montos con 2 decimales, CSV seguro para Excel (sin inyección de fórmulas), códigos e ids |
| `unit/pos-validacion.test.ts` | Datos aceptados por la API del POS: cantidades, código del cliente, clave anti-cobro-duplicado, campos no permitidos |
| `unit/app-throttler.test.ts` | Límite de peticiones por usuario (y no por IP), resistente a tokens falsificados |
| `unit/recargas-validacion.test.ts` | Módulo D: montos de recarga (mínimo Bs 10, máximo Bs 1.000, 2 decimales, solo efectivo), motivo de anulación, filtros de historiales, roles de personal y signo de los movimientos |

Estas pruebas ya encontraron y ayudaron a corregir dos errores:

- Una fecha inexistente como `2026-02-30` no se rechazaba (se convertía en silencio al 2 de marzo).
- Una cantidad `1.5` respondía "cantidad máxima 99" en lugar de "debe ser un número entero".

### 1b. Unitarias del frontend (`frontend-unit/`): Vitest + React Testing Library

Prueban las pantallas y utilidades reales de `frontend/src` en un navegador simulado (jsdom), con la API **simulada**. No usan base de datos, backend ni navegador real, y tardan unos segundos.

| Archivo | Casos | Qué protege |
|---|---|---|
| `frontend-unit/utils/format.test.js` | 18 | Montos en Bs, fechas sin correrse un día por la zona horaria, horas y mensajes de error para el usuario |
| `frontend-unit/pos/PosPage.test.jsx` | 11 | Pantalla del POS: catálogo y stock, total sin errores de redondeo, cobro completo (sin enviar precios), saldo insuficiente con aviso, **misma clave al reintentar**, saldo que cambió, errores |
| `frontend-unit/admin/RetirosPage.test.jsx` | 3 | **Regresión** de respuestas desactualizadas al cambiar de pestaña, aprobar y pago con comprobante |
| `frontend-unit/business/VentasUI.test.jsx` | 8 | Gráfico de ventas por día (escala, montos, tabla) y filtros de fecha y negocio |
| `frontend-unit/recargas/RecargaPage.test.jsx` | 16 | Terminal del recargador: recarga completa (sin enviar saldos), límites de monto y saldo máximo, **recargas pendientes sin conexión que se reintentan con la misma clave**, rechazos del servidor |

- **Una sola copia de React.** Las pruebas usan React y React Router de `frontend/node_modules`, porque con dos copias los hooks fallan. Por eso `tests/.npmrc` no instala las dependencias "peer" de Testing Library. Los alias están en `vitest.config.mjs`.
- **Verificación de mutación.** Se quitó a propósito la protección contra respuestas viejas de `RetirosPage` y la prueba de regresión falló, como se esperaba. Lo mismo con el recargador: si el reintento genera una clave nueva (y acreditaría dos veces), la prueba falla.

### 2. Integración (`integracion/`): usan la base compartida de Aiven

Necesitan `backend/.env`, `backend/prisma/ca.pem` e internet. No hace falta levantar el backend:

- las de cobro y liquidación llaman directamente a los servicios;
- la de seguridad levanta su propia instancia de la API en un puerto libre, sin chocar con `npm run start:dev`.

| Archivo | Casos | Qué protege |
|---|---|---|
| `integracion/pos-cobro.test.ts` | 25 | Cobro real contra la base: saldo insuficiente, cobros simultáneos, clave anti-duplicado, stock, horario, permisos, consulta previa e historial |
| `integracion/api-seguridad.test.ts` | 73 | Seguridad por HTTP: tokens falsos, vencidos o de cuentas desactivadas; roles de cada endpoint (50 combinaciones); datos ajenos; validación (JSON mal formado, más de 1 MB, inyección SQL); cabeceras de seguridad y CORS; límite de peticiones por usuario y de intentos de login |
| `integracion/pos-liquidacion.test.ts` | 23 | Panel de ventas del dueño (totales, días, eventos, productos, CSV), liquidación (acreditado/pendiente) y retiros (solicitud, aprobación, pago, rechazo, solicitudes simultáneas) |
| `integracion/recargas.test.ts` | 37 | Módulo D: recarga 1:1 por manilla o QR, primera recarga que crea el saldo, evento no asignado o fuera de horario, saldo máximo (también con recargas simultáneas), reintentos sin duplicar, anulación por el admin (doble, simultánea, saldo ya gastado), historiales y personal del evento |
| `integracion/recargas-seguridad.test.ts` | 79 | Seguridad por HTTP del Módulo D: roles de cada endpoint (60 combinaciones), recargador no asignado, el recargador no puede anular, el cliente solo ve lo suyo, validación y flujo completo con reintento |

Para comprobar que estas pruebas detectan errores reales, se rompieron a propósito dos protecciones y las pruebas fallaron, como se esperaba:

- permitir cobrar aunque el saldo no alcance (fallan las de saldo insuficiente);
- quitar el bloqueo de las solicitudes de retiro (falla la de solicitudes simultáneas);
- quitar la restricción de roles del panel del dueño (fallan exactamente los 9 casos de roles sin permiso);
- quitar el tope de saldo por evento en las recargas (fallan las 2 pruebas de saldo máximo);
- quitar la restricción de rol ADMIN de la anulación de recargas (fallan los 9 casos de roles sin permiso).

La prueba de recargas encontró un error real: con el filtro "Anuladas", el listado del administrador mostraba como "total vigente" la suma de las recargas vigentes. Ya está corregido.

`pos-liquidacion.test.ts` **no sube archivos a Cloudinary**: reemplaza el almacenamiento de comprobantes por uno simulado.

### 3. De punta a punta en navegador (`e2e/`): Playwright

Abren la aplicación real en **Microsoft Edge** (ya instalado en Windows; no se descarga ningún navegador) y la usan como una persona. Necesitan `backend/.env`, `backend/prisma/ca.pem`, `frontend/.env` e internet. Si el backend (puerto 3000) y el frontend (puerto 5173) no están corriendo, Playwright los levanta solo.

| Archivo | Casos | Qué protege |
|---|---|---|
| `e2e/01-pos.spec.ts` | 7 | Login del ayudante y punto de venta en el celular: cobro con manilla, comprobante, historial, saldo insuficiente, stock y código inexistente |
| `e2e/02-panel-negocio.spec.ts` | 4 | Panel del dueño: dashboard, registro de ventas, CSV, solicitud de retiro y menú lateral en el celular |
| `e2e/03-admin-retiros.spec.ts` | 3 | El administrador aprueba el retiro, el pago exige comprobante y el rechazo |
| `e2e/04-navegacion.spec.ts` | 55 | Las pantallas de cada rol (incluido el recargador) en escritorio y celular, sin errores ni desbordes; rutas protegidas; menú móvil |
| `e2e/05-recargas.spec.ts` | 9 | Módulo D: login del recargador, recarga en efectivo con la manilla, "Mis recargas", monto mínimo, "Mi Manilla" y movimientos del cliente (también en el celular), anulación por el admin, personal del evento y movimientos del evento |

- Los archivos corren **en orden y de a uno** (01 → 05) porque comparten un escenario `[PRUEBA-AUTO]`: la venta de 01 aparece en el panel de 02, el retiro que pide 02 lo revisa el administrador en 03, y la recarga de 05 es la que el administrador anula después.
- El escenario se crea al inicio (`e2e/setup/global-setup.ts`) y se borra al final, aunque las pruebas fallen. Las sesiones de cada rol se guardan en `e2e/.auth/` (ignorada por git), así las pruebas no repiten el login.
- **No suben archivos a Cloudinary.**
- Las 3 pantallas rotas conocidas (Mis Negocios, Productos y Ayudantes del jefe, pendientes del schema nuevo de negocios) aparecen como **"skipped"** (`test.fixme`). Cuando se arreglen, cámbialas a `test` en `04-navegacion.spec.ts`.
- Si una prueba falla: `npm run test:e2e:reporte` muestra cada paso con capturas y peticiones de red, y `e2e-resultados/` guarda la captura del fallo.
- Para usar Chromium en vez de Edge: `npx playwright install chromium` y la variable `PW_CHANNEL=chromium`.

Estas pruebas encontraron un error real: en **Retiros** (administrador) y en el **Dashboard** (dueño), al cambiar rápido de pestaña o de filtro, una respuesta lenta anterior podía llegar después y mostrar los datos equivocados. Ya está corregido: ahora se descartan las respuestas viejas.

También detectaron que **Mi Manilla** se desbordaba 60 px a lo ancho en el celular cuando el título del evento era largo. Ya está corregido.

## Plan de pruebas (orden de importancia)

| # | Prueba | Estado | ¿Base de datos? |
|---|---|---|---|
| 1 | Unitarias de la lógica del POS | ✅ Hecha | No |
| 2 | Integración del cobro (saldo, concurrencia, clave anti-duplicado, stock, horario, permisos) | ✅ Hecha | Sí |
| 3 | Integración de liquidación y retiros | ✅ Hecha | Sí |
| 4 | Seguridad de la API (roles, validación, límite de peticiones) | ✅ Hecha | Sí |
| 5 | Recorrido en navegador con Playwright (flujo del POS y pantallas por rol) | ✅ Hecha | Sí |
| 6 | Unitarias del frontend (formatos, POS, retiros, gráfico y filtros) | ✅ Hecha | No |
| 7 | Módulo D (recargas): unitarias, integración, seguridad, frontend y e2e | ✅ Hecha | Sí (salvo unitarias) |

### Datos de prueba en la base compartida (pruebas 2 a 5)

Las pruebas que usan base de datos trabajan sobre la base compartida de Aiven con estas reglas:

- **Crean todo lo que usan:** usuarios con correos `@pruebas.eventix.test`, su propio negocio, productos, evento y entradas. **Nunca** modifican datos reales.
- **Todo lo que crean va marcado con `[PRUEBA-AUTO]`.** Es una marca distinta de `[PRUEBA POS]`, la del seed manual del Módulo E.
- **Cada ejecución usa un sufijo aleatorio** (por ejemplo `cliente.3fa9c1d2@pruebas.eventix.test`). Así dos personas pueden correr las pruebas al mismo tiempo sin pisarse.
- **Limpieza automática:**
  - al terminar, cada ejecución borra **solo lo suyo**, aunque las pruebas hayan fallado;
  - al empezar, borra restos de **más de 2 horas** (ejecuciones que se cortaron con Ctrl+C o por un corte de internet).
- **Limpieza manual:** `npm run limpiar` muestra lo que hay y `npm run limpiar:confirmar` lo borra todo, en una transacción. Úsala si ves eventos `[PRUEBA-AUTO]` en la landing.
- **Mientras corren**, los eventos de prueba pueden verse unos segundos en la landing pública.

## Estructura

```
tests/
├── README.md          ← este archivo
├── package.json       ← scripts y dependencias de las pruebas (Jest, ts-jest, TypeScript)
├── jest.config.js     ← configuración de Jest (resuelve librerías desde backend/node_modules)
├── tsconfig.json      ← configuración de TypeScript para las pruebas
├── vitest.config.mjs  ← configuración de Vitest (pruebas del frontend)
├── .npmrc             ← evita instalar una segunda copia de React
├── unit/              ← pruebas unitarias del backend (sin base de datos)
├── frontend-unit/     ← pruebas unitarias del frontend (Vitest + jsdom)
├── playwright.config.ts ← configuración de Playwright (Edge, servidores, orden)
├── e2e/               ← pruebas en navegador (Playwright)
│   ├── setup/             ← crea y borra el escenario, guarda sesiones por rol
│   └── helpers/datos.ts   ← datos del escenario y detector de errores
├── integracion/       ← pruebas de integración (base compartida)
│   └── helpers/
│       ├── app.ts         ← levanta la API real en un puerto libre y hace peticiones HTTP
│       ├── entorno.js     ← carga backend/.env y la ruta del certificado SSL
│       ├── tiempo.js      ← tiempo máximo por prueba (la base remota es lenta)
│       ├── escenario.ts   ← crea usuarios (incluye recargadores y un admin), negocio, productos, eventos y entradas de prueba
│       └── limpieza.js    ← busca y borra los datos [PRUEBA-AUTO] (reglas de seguridad)
└── scripts/
    └── limpiar-datos-prueba.js   ← limpieza manual (npm run limpiar)
```

## Notas técnicas

- **Paquetes ESM de NestJS.** `@nestjs/jwt`, `@nestjs/config`, `@nestjs/passport` y `@nestjs/mapped-types` solo se publican como módulos ESM. `jest.config.js` los convierte a CommonJS para que Jest pueda cargarlos. Si el backend agrega otro paquete ESM y aparece el error `Must use import to load ES Module`, agrégalo a `transformIgnorePatterns`.
- **Estructura nueva de negocios.** `helpers/escenario.ts` inserta Negocio, RolNegocio, AyudanteNegocio y SolicitudNegocio con SQL, porque la base compartida es más nueva que el `schema.prisma` de la rama. Cuando se integre el schema nuevo, cámbialos a `prisma.<modelo>.create()`.
- **Validación igual a la de producción.** Las pruebas de validación usan `backend/src/common/validation/validation-pipe.options.ts`, la misma configuración que `main.ts`.
- **API igual a la de producción.** La prueba de seguridad usa `backend/src/app.setup.ts` (helmet, CORS, límite de 1 MB, validación), la misma función que llama `main.ts`.
- **Cuentas de prueba con contraseña.** La prueba de seguridad inicia sesión de verdad: sus usuarios (incluido un administrador de prueba) reciben una contraseña aleatoria distinta en cada ejecución, que nunca se muestra, y se borran al terminar.
- **Vulnerabilidad conocida en las herramientas.** `npm audit` reporta "19 vulnerabilidades moderadas", pero es **una sola**: la de `sprintf-js`, contada una vez por cada paquete que depende de ella. Es una dependencia interna de Jest. Solo afecta a las herramientas de prueba (no llega al backend ni al frontend) y corregirla exige `npm audit fix --force`, que cambia versiones de Jest. Por eso no se aplicó.
