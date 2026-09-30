-- Normaliza teléfonos a la misma forma canónica que normalizePhone() antes de exigir unicidad.
UPDATE `Usuario`
    SET `telefono` = CASE
        WHEN REGEXP_REPLACE(`telefono`, '[^0-9]', '') = '' THEN NULL
        WHEN TRIM(`telefono`) LIKE '+%' THEN CONCAT('+', REGEXP_REPLACE(`telefono`, '[^0-9]', ''))
        WHEN REGEXP_REPLACE(`telefono`, '[^0-9]', '') LIKE '00%'
            THEN CONCAT('+', SUBSTRING(REGEXP_REPLACE(`telefono`, '[^0-9]', ''), 3))
        WHEN CHAR_LENGTH(REGEXP_REPLACE(`telefono`, '[^0-9]', '')) = 8
            THEN CONCAT('+591', REGEXP_REPLACE(`telefono`, '[^0-9]', ''))
        WHEN CHAR_LENGTH(REGEXP_REPLACE(`telefono`, '[^0-9]', '')) = 11
            AND REGEXP_REPLACE(`telefono`, '[^0-9]', '') LIKE '591%'
            THEN CONCAT('+', REGEXP_REPLACE(`telefono`, '[^0-9]', ''))
        ELSE REGEXP_REPLACE(`telefono`, '[^0-9]', '')
    END
    WHERE `telefono` IS NOT NULL;

UPDATE `InvitacionUsuario`
    SET `telefono` = CASE
        WHEN REGEXP_REPLACE(`telefono`, '[^0-9]', '') = '' THEN NULL
        WHEN TRIM(`telefono`) LIKE '+%' THEN CONCAT('+', REGEXP_REPLACE(`telefono`, '[^0-9]', ''))
        WHEN REGEXP_REPLACE(`telefono`, '[^0-9]', '') LIKE '00%'
            THEN CONCAT('+', SUBSTRING(REGEXP_REPLACE(`telefono`, '[^0-9]', ''), 3))
        WHEN CHAR_LENGTH(REGEXP_REPLACE(`telefono`, '[^0-9]', '')) = 8
            THEN CONCAT('+591', REGEXP_REPLACE(`telefono`, '[^0-9]', ''))
        WHEN CHAR_LENGTH(REGEXP_REPLACE(`telefono`, '[^0-9]', '')) = 11
            AND REGEXP_REPLACE(`telefono`, '[^0-9]', '') LIKE '591%'
            THEN CONCAT('+', REGEXP_REPLACE(`telefono`, '[^0-9]', ''))
        ELSE REGEXP_REPLACE(`telefono`, '[^0-9]', '')
    END
    WHERE `telefono` IS NOT NULL;

-- Documento: mayúsculas y sin espacios, puntos ni guiones (igual que normalizeDocument()).
UPDATE `Usuario`
    SET `documento` = NULLIF(UPPER(REGEXP_REPLACE(`documento`, '[[:space:].-]', '')), '')
    WHERE `documento` IS NOT NULL;

-- Falla si ya existen duplicados: hay que resolverlos manualmente antes de aplicar.
CREATE UNIQUE INDEX `Usuario_telefono_key` ON `Usuario`(`telefono`);
CREATE UNIQUE INDEX `Usuario_documento_key` ON `Usuario`(`documento`);
