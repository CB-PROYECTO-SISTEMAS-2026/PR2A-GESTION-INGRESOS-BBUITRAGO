-- Sprint 2: HU-047 (incidencias de recarga) y HU-046 (rechazos por foto en el control de acceso).
-- Solo crea tablas nuevas; no modifica ni borra nada existente.

CREATE TABLE IF NOT EXISTS `AccesoRechazo` (
    `id` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `entradaId` VARCHAR(191) NOT NULL,
    `fechaId` VARCHAR(191) NULL,
    `encargadoId` VARCHAR(191) NULL,
    `sentido` VARCHAR(10) NOT NULL,
    `motivo` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AccesoRechazo_eventoId_fechaId_idx`(`eventoId`, `fechaId`),
    INDEX `AccesoRechazo_entradaId_idx`(`entradaId`),
    INDEX `AccesoRechazo_encargadoId_idx`(`encargadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `IncidenciaRecarga` (
    `id` VARCHAR(191) NOT NULL,
    `transaccionId` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `recargadorId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('MONTO_INCORRECTO', 'CLIENTE_EQUIVOCADO', 'RECARGA_DUPLICADA', 'NO_SE_REFLEJA', 'OTRO') NOT NULL,
    `descripcion` VARCHAR(500) NOT NULL,
    `estado` ENUM('ABIERTA', 'RESUELTA') NOT NULL DEFAULT 'ABIERTA',
    `resolucion` VARCHAR(500) NULL,
    `resueltaPorId` VARCHAR(191) NULL,
    `resueltaAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IncidenciaRecarga_transaccionId_idx`(`transaccionId`),
    INDEX `IncidenciaRecarga_eventoId_idx`(`eventoId`),
    INDEX `IncidenciaRecarga_recargadorId_idx`(`recargadorId`),
    INDEX `IncidenciaRecarga_resueltaPorId_idx`(`resueltaPorId`),
    INDEX `IncidenciaRecarga_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AccesoRechazo` ADD CONSTRAINT `AccesoRechazo_encargadoId_fkey` FOREIGN KEY (`encargadoId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AccesoRechazo` ADD CONSTRAINT `AccesoRechazo_entradaId_fkey` FOREIGN KEY (`entradaId`) REFERENCES `Entrada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccesoRechazo` ADD CONSTRAINT `AccesoRechazo_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccesoRechazo` ADD CONSTRAINT `AccesoRechazo_fechaId_fkey` FOREIGN KEY (`fechaId`) REFERENCES `FechaEvento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `IncidenciaRecarga` ADD CONSTRAINT `IncidenciaRecarga_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `IncidenciaRecarga` ADD CONSTRAINT `IncidenciaRecarga_recargadorId_fkey` FOREIGN KEY (`recargadorId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `IncidenciaRecarga` ADD CONSTRAINT `IncidenciaRecarga_resueltaPorId_fkey` FOREIGN KEY (`resueltaPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `IncidenciaRecarga` ADD CONSTRAINT `IncidenciaRecarga_transaccionId_fkey` FOREIGN KEY (`transaccionId`) REFERENCES `TransaccionSaldo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
