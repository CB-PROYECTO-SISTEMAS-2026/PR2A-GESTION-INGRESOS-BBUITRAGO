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
| `npm test` | Corre todas las pruebas |
| `npm run test:unit` | Corre solo las pruebas unitarias (no necesitan base de datos ni servidor) |
| `npm run test:watch` | Modo vigilancia: vuelve a correr las unitarias cada vez que guardas un archivo |
| `npx jest unit/pos-dates.test.ts` | Corre un solo archivo |
| `npx jest -t "medianoche"` | Corre solo las pruebas cuyo nombre contiene ese texto |

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

## Plan de pruebas (orden de importancia)

| # | Prueba | Estado | ¿Base de datos? |
|---|---|---|---|
| 1 | Unitarias de la lógica del POS | ✅ Hecha | No |
| 2 | Integración del cobro (saldo, concurrencia, clave anti-duplicado, stock, horario, permisos) | Pendiente | Sí |
| 3 | Integración de liquidación y retiros | Pendiente | Sí |
| 4 | Seguridad de la API (roles, validación, límite de peticiones) | Pendiente | Sí |
| 5 | Recorrido en navegador con Playwright (flujo del POS y pantallas por rol) | Pendiente | Sí |
| 6 | Unitarias del frontend (formatos y carrito) | Pendiente | No |

### Datos de prueba en la base compartida (pruebas 2 a 5)

Las pruebas que usan base de datos trabajan sobre la base compartida de Aiven con estas reglas:

- **Crean todo lo que usan:** usuarios con correos `@pruebas.eventix.test`, su propio negocio, productos, evento y entradas. **Nunca** modifican datos reales.
- **Todo lo que crean va marcado con `[PRUEBA-AUTO]`.** Es una marca distinta de `[PRUEBA POS]`, la del seed manual del Módulo E.
- **Limpieza automática** al empezar (por si quedó algo de una ejecución que falló a la mitad) y al terminar.
- **Script de limpieza manual** (aún no creado, llega con la prueba 2). Muestra lo que borraría y solo borra con `--confirmar`.

## Estructura

```
tests/
├── README.md          ← este archivo
├── package.json       ← scripts y dependencias de las pruebas (Jest, ts-jest, TypeScript)
├── jest.config.js     ← configuración de Jest (resuelve librerías desde backend/node_modules)
├── tsconfig.json      ← configuración de TypeScript para las pruebas
└── unit/              ← pruebas unitarias (sin base de datos)
```

## Notas técnicas

- **Paquetes ESM de NestJS.** `@nestjs/jwt`, `@nestjs/config`, `@nestjs/passport` y `@nestjs/mapped-types` solo se publican como módulos ESM. `jest.config.js` los convierte a CommonJS para que Jest pueda cargarlos. Si el backend agrega otro paquete ESM y aparece el error `Must use import to load ES Module`, agrégalo a `transformIgnorePatterns`.
- **Validación igual a la de producción.** Las pruebas de validación usan `backend/src/common/validation/validation-pipe.options.ts`, la misma configuración que `main.ts`.
- **Vulnerabilidad conocida en las herramientas.** `npm audit` reporta una vulnerabilidad moderada en `sprintf-js`, que es una dependencia interna de Jest. Solo afecta a las herramientas de prueba (no llega al backend ni al frontend) y corregirla exige `npm audit fix --force`, que cambia versiones de Jest. Por eso no se aplicó.
