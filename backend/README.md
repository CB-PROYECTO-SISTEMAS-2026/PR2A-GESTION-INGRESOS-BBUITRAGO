# EvenTix Backend

NestJS + Prisma + MySQL 8 · API REST con JWT

## Requisitos
- Node.js 20+
- Acceso a la base MySQL compartida en Aiven (credenciales y certificado `ca.pem`)
- Cuenta de Cloudinary (todos los archivos: mapas, fotos de eventos)
- Cuenta de correo SMTP (Gmail con contraseña de aplicación) para invitaciones y recuperación de contraseña

## Configuración
1. Copia `.env.example` como `.env` y completa todos los valores. La API no arranca si falta alguno
   obligatorio o si `JWT_SECRET` es débil. Las credenciales se comparten por un canal privado, nunca en el repositorio.
2. Guarda el certificado de Aiven como `prisma/ca.pem` (está ignorado por git).
3. `npm install`
4. `npm run start:dev` → API en `http://localhost:3000/api`

## Base de datos compartida
Todo el equipo trabaja sobre la misma base MySQL en Aiven: los datos que alguien crea o modifica
desde la app los ven los demás al instante. No hay seeds ni base local.

- La estructura (tablas y columnas) solo la modifica el responsable de la base, directamente en Aiven.
  El resto del equipo usa un usuario sin permisos para alterar tablas.
- Después de cada cambio de estructura, el responsable ejecuta `npm run db:sync`, que actualiza
  `prisma/schema.prisma` desde la base, y sube ese archivo al repositorio.
- El resto solo hace `git pull`: `npm run start:dev` regenera el cliente de Prisma al arrancar.
- `db:sync` reescribe `schema.prisma` completo: los comentarios sueltos se pierden.
- Prohibido sobre la base compartida: `prisma migrate dev`, `prisma migrate reset` y `prisma db push`.
- Antes de cada cambio de estructura se saca un respaldo con `mysqldump`.

## Scripts útiles
| Script | Uso |
|--------|-----|
| `npm run start:dev` | Regenera el cliente de Prisma y levanta la API en modo watch |
| `npm run db:sync` | Actualiza `prisma/schema.prisma` desde la base y regenera el cliente |

## Usuarios de prueba
| Rol | Email | Password |
|-----|-------|----------|
| ADMIN | admin@eventix.com | Admin123! |
| ORGANIZADOR | organizador@eventix.com | Organiza123! |
| CLIENTE | cliente@eventix.com | Cliente123! |
| JEFE_NEGOCIO | negocio@eventix.com | Negocio123! |
| AYUDANTE | ayudante@eventix.com | Ayudante123! |
| ENCARGADO_ACCESO | acceso@eventix.com | Acceso123! |
| RECARGADOR | recargador@eventix.com | Recarga123! |
| DEVOLUCIONES | devoluciones@eventix.com | Devol123! |

Las cuentas de administradores, organizadores y jefes de negocio reales se crean por invitación
desde el panel **Admin → Usuarios**: el invitado recibe un correo y la cuenta se crea al aceptarlo.

## Módulos
`auth`, `users`, `admin-users`, `events`, `tickets`, `businesses`, y los servicios comunes
`common/mail` (SMTP) y `common/storage` (Cloudinary).

## Seguridad
- Helmet, CORS restringido a `CORS_ORIGINS` y rate limiting global (más estricto en autenticación).
- Validación estricta de entrada: se rechazan campos no declarados en los DTO.
- Tokens de invitación y recuperación guardados como hash SHA-256, de un solo uso y con expiración.
- Los archivos se validan por su contenido real (no por la extensión) antes de subirlos.
