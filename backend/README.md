# EvenTix Backend

NestJS + Prisma + MySQL 8 · API REST con JWT

## Requisitos
- Node.js 20+
- MySQL 8
- Cuenta de Cloudinary (todos los archivos: mapas, fotos de eventos)
- Cuenta de correo SMTP (Gmail con contraseña de aplicación) para invitaciones y recuperación de contraseña

## Configuración
1. `npm install`
2. Copia `.env.example` como `.env` y completa todos los valores. La API no arranca si falta alguno
   obligatorio o si `JWT_SECRET` es débil. Las credenciales se comparten por un canal privado, nunca en el repositorio.
3. Aplica las migraciones y, en desarrollo, carga los datos de prueba:
```bash
npm run prisma:deploy
npm run prisma:seed
```
4. `npm run start:dev` → API en `http://localhost:3000/api`

Para cambiar el schema: edita `prisma/schema.prisma` y crea una migración con `npm run prisma:migrate`.
No uses `prisma db push` sobre la base compartida.

## Scripts útiles
| Script | Uso |
|--------|-----|
| `npm run prisma:deploy` | Aplica las migraciones pendientes |
| `npm run prisma:seed` | Borra y recrea los datos de prueba (bloqueado con `NODE_ENV=production`) |

## Usuarios de prueba (solo seed de desarrollo)
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
