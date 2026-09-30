-- Foto de perfil del usuario
ALTER TABLE `Usuario` ADD COLUMN `fotoUrl` VARCHAR(191) NULL;
ALTER TABLE `Usuario` ADD COLUMN `fotoPublicId` VARCHAR(191) NULL;

-- Horario único: la apertura de puertas y el cierre del cronograma pasan a ser
-- la hora de inicio y de fin de cada día del evento.
UPDATE `FechaEvento` f
    INNER JOIN `Evento` e ON e.`id` = f.`eventoId`
    SET f.`horaInicio` = JSON_UNQUOTE(JSON_EXTRACT(e.`cronograma`, '$.apertura')),
        f.`horaFin` = JSON_UNQUOTE(JSON_EXTRACT(e.`cronograma`, '$.cierre'))
    WHERE JSON_TYPE(JSON_EXTRACT(e.`cronograma`, '$.apertura')) = 'STRING'
      AND JSON_TYPE(JSON_EXTRACT(e.`cronograma`, '$.cierre')) = 'STRING'
      AND JSON_UNQUOTE(JSON_EXTRACT(e.`cronograma`, '$.apertura')) < JSON_UNQUOTE(JSON_EXTRACT(e.`cronograma`, '$.cierre'));
