# Cómo tocar la BDD sin romper lo que vas a poblar

## Respuesta corta

1. **Podés poblar ahora** con el schema actual.
2. **Antes de levantar el backend nuevo**, corré en Aiven (usuario con ALTER / `ADMIN_DATABASE_URL`) lo que falte:
   - `alter_reembolso_evidencia.sql`
   - `alter_evento_spotify.sql` (columna `Evento.spotifyUrl`, nullable) — si ya existe, ignorá el error de columna duplicada.
   - `alter_identidad_asignacion.sql` (identidad HMAC, asignaciones, verificación en puerta) — si una columna/tabla ya existe, ignorá el error de duplicado.
   - `alter_categoria_evento.sql` + `node prisma/manual/aplicar-categoria-evento.mjs` (temáticas `CategoriaEvento`, **no** confundir con `CategoriaEntrada` de tickets).
   - `alter_organizador_productora.sql` (`Usuario.nombreProductora` + backfill desde `SolicitudEvento.empresa`).
   El usuario `eventix_dev` **no** tiene permiso ALTER; usá `ADMIN_DATABASE_URL` o la consola Aiven.
   Además configurá en `.env`: `IDENTITY_HMAC_SECRET_V1`, `SUFFIX_HMAC_SECRET_V1` (ver `.env.example`).
3. **No uses** `prisma migrate reset`, `db push --force-reset` ni borrar la base “para probar”.

## Qué es “migraciones” en Prisma (en cristiano)

Prisma puede **versionar** cambios de tablas (`prisma migrate`).  
En este proyecto hoy usamos sobre todo:

```bash
npm run db:sync
# = prisma db pull && prisma generate
```

Eso **lee** lo que ya hay en Aiven y regenera el cliente.  
**No aplica** cambios solos a la base.

Si el código pide una columna nueva y la base no la tiene → la API truena al usar esa feature.

## Orden seguro para vos

```
1. Poblar usuarios/eventos/etc. (datos de demo)
2. Ejecutar alter_reembolso_evidencia.sql en Aiven
3. En el repo: npx prisma generate   (o npm run db:sync si preferís pull)
4. Arrancar backend
```

Si ya poblaste y después corrés el `ALTER`, **tampoco pasa nada**: la columna entra vacía (`NULL`).

## Qué NO hacer

| Comando / acción | Efecto |
|---|---|
| `prisma migrate reset` | **Borra toda la data** |
| Borrar schema a mano en Aiven | Pierdes el seed |
| Cambiar tipos de columnas con datos | Puede fallar el ALTER |

## Cola de correos

Usa la tabla `Archivo` que **ya existe** (tipo `MAIL_OUTBOX`). No necesitás tabla nueva para eso.
