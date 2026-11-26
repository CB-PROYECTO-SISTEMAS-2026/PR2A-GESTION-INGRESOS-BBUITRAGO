-- Marca pública del organizador (productora). Nullable.
-- Correr en Aiven (MySQL) una sola vez. Si la columna ya existe, ignorá el error de duplicado.

ALTER TABLE `Usuario`
  ADD COLUMN `nombreProductora` VARCHAR(191) NULL;

-- Backfill: última solicitud con empresa no vacía → productora de la cuenta (solo si aún está vacío).
UPDATE `Usuario` u
INNER JOIN (
  SELECT s.organizadorId, s.empresa
  FROM `SolicitudEvento` s
  INNER JOIN (
    SELECT organizadorId, MAX(createdAt) AS maxCreated
    FROM `SolicitudEvento`
    WHERE empresa IS NOT NULL AND TRIM(empresa) <> ''
    GROUP BY organizadorId
  ) latest
    ON latest.organizadorId = s.organizadorId
   AND latest.maxCreated = s.createdAt
  WHERE s.empresa IS NOT NULL AND TRIM(s.empresa) <> ''
) src ON src.organizadorId = u.id
SET u.nombreProductora = LEFT(TRIM(src.empresa), 191)
WHERE u.nombreProductora IS NULL OR TRIM(u.nombreProductora) = '';
