-- Sprint 2, Módulo B: quién entregó cada manilla (HU-015) y supervisores por punto de entrega (HU-053)
ALTER TABLE `Manilla` ADD COLUMN `entregadaPorId` VARCHAR(191) NULL;

CREATE TABLE `SupervisorPuntoRetiro` (
    `id` VARCHAR(191) NOT NULL,
    `puntoRetiroId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SupervisorPuntoRetiro_puntoRetiroId_usuarioId_key`(`puntoRetiroId`, `usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Manilla` ADD CONSTRAINT `Manilla_entregadaPorId_fkey` FOREIGN KEY (`entregadaPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupervisorPuntoRetiro` ADD CONSTRAINT `SupervisorPuntoRetiro_puntoRetiroId_fkey` FOREIGN KEY (`puntoRetiroId`) REFERENCES `PuntoRetiroManilla`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupervisorPuntoRetiro` ADD CONSTRAINT `SupervisorPuntoRetiro_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
