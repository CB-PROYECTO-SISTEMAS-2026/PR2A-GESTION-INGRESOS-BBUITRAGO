-- Solicitudes: horario separado de la fecha (mismo horario todos los días).
ALTER TABLE `SolicitudEvento` ADD COLUMN `horaInicio` VARCHAR(5) NULL,
    ADD COLUMN `horaFin` VARCHAR(5) NULL;

UPDATE `SolicitudEvento`
    SET `horaInicio` = DATE_FORMAT(`fechaInicio`, '%H:%i'),
        `horaFin` = DATE_FORMAT(COALESCE(`fechaFin`, `fechaInicio`), '%H:%i');

UPDATE `SolicitudEvento` SET `horaFin` = '23:59' WHERE `horaFin` <= `horaInicio`;

-- Evento de un solo día: sin fecha de fin.
UPDATE `SolicitudEvento` SET `fechaFin` = NULL
    WHERE `fechaFin` IS NOT NULL AND DATE(`fechaFin`) = DATE(`fechaInicio`);

ALTER TABLE `SolicitudEvento` MODIFY `fechaInicio` DATE NOT NULL,
    MODIFY `fechaFin` DATE NULL,
    MODIFY `horaInicio` VARCHAR(5) NOT NULL,
    MODIFY `horaFin` VARCHAR(5) NOT NULL;

-- Fechas de evento: día sin hora y horario obligatorio.
UPDATE `FechaEvento`
    SET `horaInicio` = COALESCE(`horaInicio`, DATE_FORMAT(`fecha`, '%H:%i')),
        `horaFin` = COALESCE(`horaFin`, '23:59');

ALTER TABLE `FechaEvento` MODIFY `fecha` DATE NOT NULL,
    MODIFY `horaInicio` VARCHAR(5) NOT NULL,
    MODIFY `horaFin` VARCHAR(5) NOT NULL;

-- Un evento no puede tener el mismo día dos veces.
CREATE UNIQUE INDEX `FechaEvento_eventoId_fecha_key` ON `FechaEvento`(`eventoId`, `fecha`);
