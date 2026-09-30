-- Baja lógica de usuarios
ALTER TABLE `Usuario` ADD COLUMN `eliminadoAt` DATETIME(3) NULL;

-- Enlace de Google Maps de la ubicación
ALTER TABLE `SolicitudEvento` ADD COLUMN `ubicacionUrl` VARCHAR(500) NULL;
ALTER TABLE `Evento` ADD COLUMN `ubicacionUrl` VARCHAR(500) NULL;

-- Tipo de acceso: QR_FISICO pasa a MANILLA y se agrega AMBOS
ALTER TABLE `Evento` MODIFY `tipoAcceso` ENUM('QR_DIGITAL', 'QR_FISICO', 'MANILLA', 'AMBOS') NOT NULL DEFAULT 'QR_DIGITAL';
UPDATE `Evento` SET `tipoAcceso` = 'MANILLA' WHERE `tipoAcceso` = 'QR_FISICO';
ALTER TABLE `Evento` MODIFY `tipoAcceso` ENUM('QR_DIGITAL', 'MANILLA', 'AMBOS') NOT NULL DEFAULT 'QR_DIGITAL';

-- Servicios: texto separado por líneas, comas o "·" -> arreglo JSON de nombres
ALTER TABLE `Evento` ADD COLUMN `serviciosLista` JSON NULL;
UPDATE `Evento` e
    SET e.`serviciosLista` = (
        SELECT JSON_ARRAYAGG(TRIM(t.item))
        FROM JSON_TABLE(
            CONCAT('["', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                e.`servicios`, '\\', '\\\\'), '"', '\\"'), '\r', ''), '\t', ' '), '·', '\n'), ',', '\n'), '\n', '","'), '"]'),
            '$[*]' COLUMNS (item VARCHAR(191) PATH '$')
        ) t
        WHERE TRIM(t.item) <> ''
    )
    WHERE e.`servicios` IS NOT NULL AND TRIM(e.`servicios`) <> '';
ALTER TABLE `Evento` DROP COLUMN `servicios`;
ALTER TABLE `Evento` RENAME COLUMN `serviciosLista` TO `servicios`;

-- Cronograma: líneas "HH:mm — actividad" -> { apertura, cierre, actividades[] }
-- La primera línea con hora se toma como apertura de puertas y la última como cierre.
CREATE TABLE `_cronograma_legacy` AS
    SELECT e.`id` AS `eventoId`, t.`n`,
        LPAD(REGEXP_SUBSTR(TRIM(t.`item`), '^[0-9]{1,2}:[0-5][0-9]'), 5, '0') AS `hora`,
        LEFT(TRIM(REGEXP_REPLACE(TRIM(t.`item`), '^[0-9]{1,2}:[0-5][0-9][^[:alnum:]]*', '')), 120) AS `actividad`
    FROM `Evento` e,
        JSON_TABLE(
            CONCAT('["', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                e.`cronograma`, '\\', '\\\\'), '"', '\\"'), '\r', ''), '\t', ' '), '\n', '","'), '"]'),
            '$[*]' COLUMNS (`n` FOR ORDINALITY, `item` VARCHAR(500) PATH '$')
        ) t
    WHERE e.`cronograma` IS NOT NULL AND REGEXP_LIKE(TRIM(t.`item`), '^[0-9]{1,2}:[0-5][0-9]');

CREATE TABLE `_cronograma_limites` AS
    SELECT `eventoId`, MIN(`n`) AS `primero`, MAX(`n`) AS `ultimo`
    FROM `_cronograma_legacy`
    GROUP BY `eventoId`
    HAVING COUNT(*) >= 2;

ALTER TABLE `Evento` ADD COLUMN `cronogramaPlan` JSON NULL;
UPDATE `Evento` e
    INNER JOIN `_cronograma_limites` l ON l.`eventoId` = e.`id`
    SET e.`cronogramaPlan` = JSON_OBJECT(
        'apertura', (SELECT c.`hora` FROM `_cronograma_legacy` c WHERE c.`eventoId` = e.`id` AND c.`n` = l.`primero`),
        'cierre', (SELECT c.`hora` FROM `_cronograma_legacy` c WHERE c.`eventoId` = e.`id` AND c.`n` = l.`ultimo`),
        'actividades', COALESCE(
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('hora', c.`hora`, 'actividad', c.`actividad`))
             FROM `_cronograma_legacy` c
             WHERE c.`eventoId` = e.`id` AND c.`n` > l.`primero` AND c.`n` < l.`ultimo`),
            JSON_ARRAY()
        )
    );
DROP TABLE `_cronograma_limites`;
DROP TABLE `_cronograma_legacy`;
ALTER TABLE `Evento` DROP COLUMN `cronograma`;
ALTER TABLE `Evento` RENAME COLUMN `cronogramaPlan` TO `cronograma`;

-- Beneficios de categoría: texto por líneas -> arreglo JSON
ALTER TABLE `CategoriaEntrada` ADD COLUMN `beneficiosLista` JSON NULL;
UPDATE `CategoriaEntrada` c
    SET c.`beneficiosLista` = (
        SELECT JSON_ARRAYAGG(TRIM(t.item))
        FROM JSON_TABLE(
            CONCAT('["', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                c.`beneficios`, '\\', '\\\\'), '"', '\\"'), '\r', ''), '\t', ' '), '·', '\n'), '\n', '","'), '"]'),
            '$[*]' COLUMNS (item VARCHAR(191) PATH '$')
        ) t
        WHERE TRIM(t.item) <> ''
    )
    WHERE c.`beneficios` IS NOT NULL AND TRIM(c.`beneficios`) <> '';
ALTER TABLE `CategoriaEntrada` DROP COLUMN `beneficios`;
ALTER TABLE `CategoriaEntrada` RENAME COLUMN `beneficiosLista` TO `beneficios`;

-- El descuento por categoría deja de existir; el cupo pasa a ser obligatorio
ALTER TABLE `CategoriaEntrada` DROP COLUMN `descuento`;
UPDATE `CategoriaEntrada` c
    SET c.`cupo` = GREATEST(1, (SELECT COUNT(*) FROM `TicketPool` t WHERE t.`categoriaId` = c.`id`))
    WHERE c.`cupo` IS NULL;
ALTER TABLE `CategoriaEntrada` MODIFY `cupo` INTEGER NOT NULL;
