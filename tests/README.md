# Pruebas automatizadas de Eventix

Esta carpeta contiene las pruebas automatizadas del proyecto. Es independiente del backend y del frontend: tiene su propio `package.json`, pero prueba **el código real** de `backend/src` usando las mismas librerías instaladas en `backend/node_modules`.

## Cómo ejecutarlas

Requisitos previos (una sola vez):

```bash
cd backend && npm install     # el backend debe tener sus dependencias y el cliente de Prisma
cd ../tests && npm install    # instala Jest y TypeScript para las pruebas
```

Comandos (siempre desde la carpeta `tests/`):

| Comando | Qué hace |
|---|---|
| `npm test` | Corre todas: primero las unitarias y, si pasan, las de integración (~5 min) |
| `npm run test:unit` | Solo las unitarias (~1 s, no necesitan base de datos ni servidor) |
| `npm run test:integracion` | Solo las de integración (usan la base compartida, una tras otra) |
| `npm run test:watch` | Modo vigilancia: vuelve a correr las unitarias cada vez que guardas un archivo |
| `npx jest unit/pos-dates.test.ts` | Corre un solo archivo unitario |
| `npx jest --runInBand integracion/pos-cobro` | Corre un solo archivo de integración |
| `npx jest -t "medianoche"` | Corre solo las pruebas cuyo nombre contiene ese texto |
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

Estas pruebas ya encontraron y ayudaron a corregir dos errores:

- Una fecha inexistente como `2026-02-30` no se rechazaba (se convertía en silencio al 2 de marzo).
- Una cantidad `1.5` respondía "cantidad máxima 99" en lugar de "debe ser un número entero".

### 2. Integración (`integracion/`): usan la base compartida de Aiven

Necesitan `backend/.env`, `backend/prisma/ca.pem` e internet. No hace falta levantar el backend:

- las de cobro y liquidación llaman directamente a los servicios;
- la de seguridad levanta su propia instancia de la API en un puerto libre, sin chocar con `npm run start:dev`.

| Archivo | Casos | Qué protege |
|---|---|---|
| `integracion/pos-cobro.test.ts` | 25 | Cobro real contra la base: saldo insuficiente, cobros simultáneos, clave anti-duplicado, stock, horario, permisos, consulta previa e historial |
| `integracion/api-seguridad.test.ts` | 73 | Seguridad por HTTP: tokens falsos, vencidos o de cuentas desactivadas; roles de cada endpoint (50 combinaciones); datos ajenos; validación (JSON mal formado, más de 1 MB, inyección SQL); cabeceras de seguridad y CORS; límite de peticiones por usuario y de intentos de login |
| `integracion/pos-liquidacion.test.ts` | 23 | Panel de ventas del dueño (totales, días, eventos, productos, CSV), liquidación (acreditado/pendiente) y retiros (solicitud, aprobación, pago, rechazo, solicitudes simultáneas) |

Para comprobar que estas pruebas detectan errores reales, se rompieron a propósito dos protecciones y las pruebas fallaron, como se esperaba:

- permitir cobrar aunque el saldo no alcance (fallan las de saldo insuficiente);
- quitar el bloqueo de las solicitudes de retiro (falla la de solicitudes simultáneas);
- quitar la restricción de roles del panel del dueño (fallan exactamente los 9 casos de roles sin permiso).

`pos-liquidacion.test.ts` **no sube archivos a Cloudinary**: reemplaza el almacenamiento de comprobantes por uno simulado.

## Plan de pruebas (orden de importancia)

| # | Prueba | Estado | ¿Base de datos? |
|---|---|---|---|
| 1 | Unitarias de la lógica del POS | ✅ Hecha | No |
| 2 | Integración del cobro (saldo, concurrencia, clave anti-duplicado, stock, horario, permisos) | ✅ Hecha | Sí |
| 3 | Integración de liquidación y retiros | ✅ Hecha | Sí |
| 4 | Seguridad de la API (roles, validación, límite de peticiones) | ✅ Hecha | Sí |
| 5 | Recorrido en navegador con Playwright (flujo del POS y pantallas por rol) | Pendiente | Sí |
| 6 | Unitarias del frontend (formatos y carrito) | Pendiente | No |

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
├── unit/              ← pruebas unitarias (sin base de datos)
├── integracion/       ← pruebas de integración (base compartida)
│   └── helpers/
│       ├── app.ts         ← levanta la API real en un puerto libre y hace peticiones HTTP
│       ├── entorno.js     ← carga backend/.env y la ruta del certificado SSL
│       ├── tiempo.js      ← tiempo máximo por prueba (la base remota es lenta)
│       ├── escenario.ts   ← crea usuarios, negocio, productos, eventos y entradas de prueba
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
- **Vulnerabilidad conocida en las herramientas.** `npm audit` reporta una vulnerabilidad moderada en `sprintf-js`, que es una dependencia interna de Jest. Solo afecta a las herramientas de prueba (no llega al backend ni al frontend) y corregirla exige `npm audit fix --force`, que cambia versiones de Jest. Por eso no se aplicó.
