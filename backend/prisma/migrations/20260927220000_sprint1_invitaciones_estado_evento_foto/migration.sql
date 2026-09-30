-- Tokens de recuperación previos se guardaban en texto plano; se invalidan.
DELETE FROM `PasswordResetToken`;

-- DropIndex
DROP INDEX `PasswordResetToken_token_key` ON `PasswordResetToken`;

-- AlterTable
ALTER TABLE `PasswordResetToken` DROP COLUMN `token`,
    ADD COLUMN `tokenHash` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `PasswordResetToken_tokenHash_key` ON `PasswordResetToken`(`tokenHash`);

-- AlterTable
ALTER TABLE `Evento` ADD COLUMN `fotoPublicId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `SolicitudEvento` MODIFY `estado` ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA', 'EVENTO_CREADO') NOT NULL DEFAULT 'PENDIENTE';

-- Solicitudes que ya tienen evento pasan al nuevo estado.
UPDATE `SolicitudEvento` s
    INNER JOIN `Evento` e ON e.`solicitudId` = s.`id`
    SET s.`estado` = 'EVENTO_CREADO';

-- CreateTable
CREATE TABLE `InvitacionUsuario` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'ORGANIZADOR', 'CLIENTE', 'JEFE_NEGOCIO', 'AYUDANTE', 'ENCARGADO_ACCESO', 'RECARGADOR', 'DEVOLUCIONES') NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `estado` ENUM('PENDIENTE', 'ACEPTADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    `creadoPorId` VARCHAR(191) NOT NULL,
    `aceptadaAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InvitacionUsuario_tokenHash_key`(`tokenHash`),
    INDEX `InvitacionUsuario_email_estado_idx`(`email`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InvitacionUsuario` ADD CONSTRAINT `InvitacionUsuario_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
