-- Identidad HMAC, asignación de titulares y verificación en puerta.
-- Ejecutar en Aiven (usuario con ALTER). Si una sentencia falla por "already exists", continuar.
-- No guarda el documento completo en ninguna tabla.

-- 1) Quitar unicidad del documento en claro (pasará a máscara).
-- Buscá el nombre del índice único en information_schema si este falla:
--   ALTER TABLE `Usuario` DROP INDEX `Usuario_documento_key`;

ALTER TABLE `Usuario` DROP INDEX `Usuario_documento_key`;

-- 2) Identidad
CREATE TABLE IF NOT EXISTS `IdentidadUsuario` (
  `id` VARCHAR(191) NOT NULL,
  `usuarioId` VARCHAR(191) NOT NULL,
  `nombresLegales` VARCHAR(191) NOT NULL,
  `apellidosLegales` VARCHAR(191) NOT NULL,
  `documentType` VARCHAR(20) NOT NULL,
  `documentCountry` VARCHAR(2) NOT NULL,
  `documentMask` VARCHAR(32) NOT NULL,
  `tieneComplemento` BOOLEAN NOT NULL DEFAULT false,
  `identityHmac` VARCHAR(64) NOT NULL,
  `identityKeyVersion` INT NOT NULL,
  `suffixHmac` VARCHAR(64) NOT NULL,
  `suffixKeyVersion` INT NOT NULL,
  `consentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IdentidadUsuario_usuarioId_key` (`usuarioId`),
  UNIQUE KEY `IdentidadUsuario_identityHmac_identityKeyVersion_key` (`identityHmac`, `identityKeyVersion`),
  KEY `IdentidadUsuario_suffixHmac_suffixKeyVersion_idx` (`suffixHmac`, `suffixKeyVersion`),
  CONSTRAINT `IdentidadUsuario_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuditoriaIdentidad` (
  `id` VARCHAR(191) NOT NULL,
  `usuarioId` VARCHAR(191) NOT NULL,
  `accion` VARCHAR(40) NOT NULL,
  `detalle` VARCHAR(500) NULL,
  `actorId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AuditoriaIdentidad_usuarioId_createdAt_idx` (`usuarioId`, `createdAt`),
  CONSTRAINT `AuditoriaIdentidad_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) Evento: reglas de transferencia
ALTER TABLE `Evento` ADD COLUMN `permiteTransferencias` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `Evento` ADD COLUMN `transferenciaHasta` DATETIME(3) NULL;

-- 4) Entrada / Credencial / Acceso
ALTER TABLE `Entrada` ADD COLUMN `titularEstado` ENUM('SIN_ASIGNAR','INVITACION_PENDIENTE','ASIGNADA','CANCELADA','REVOCADA') NOT NULL DEFAULT 'SIN_ASIGNAR';
ALTER TABLE `Entrada` ADD COLUMN `tokenVersion` INT NOT NULL DEFAULT 1;
ALTER TABLE `Credencial` ADD COLUMN `version` INT NOT NULL DEFAULT 1;
ALTER TABLE `Credencial` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
ALTER TABLE `AccesoEvento` ADD COLUMN `verificacionIdentidad` BOOLEAN NULL;

CREATE TABLE IF NOT EXISTS `AsignacionEntrada` (
  `id` VARCHAR(191) NOT NULL,
  `entradaId` VARCHAR(191) NOT NULL,
  `remitenteId` VARCHAR(191) NOT NULL,
  `destinatarioEmail` VARCHAR(191) NOT NULL,
  `destinatarioId` VARCHAR(191) NULL,
  `tokenHash` VARCHAR(191) NULL,
  `tipo` ENUM('INVITACION','TRANSFERENCIA') NOT NULL DEFAULT 'INVITACION',
  `estado` ENUM('PENDIENTE','ACEPTADA','RECHAZADA','CANCELADA','EXPIRADA') NOT NULL DEFAULT 'PENDIENTE',
  `expiresAt` DATETIME(3) NULL,
  `acceptedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AsignacionEntrada_tokenHash_key` (`tokenHash`),
  KEY `AsignacionEntrada_entradaId_estado_idx` (`entradaId`, `estado`),
  KEY `AsignacionEntrada_destinatarioEmail_estado_idx` (`destinatarioEmail`, `estado`),
  KEY `AsignacionEntrada_destinatarioId_estado_idx` (`destinatarioId`, `estado`),
  KEY `AsignacionEntrada_remitenteId_fkey` (`remitenteId`),
  CONSTRAINT `AsignacionEntrada_entradaId_fkey` FOREIGN KEY (`entradaId`) REFERENCES `Entrada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AsignacionEntrada_remitenteId_fkey` FOREIGN KEY (`remitenteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AsignacionEntrada_destinatarioId_fkey` FOREIGN KEY (`destinatarioId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `VerificacionIdentidadIntento` (
  `id` VARCHAR(191) NOT NULL,
  `entradaId` VARCHAR(191) NOT NULL,
  `eventoId` VARCHAR(191) NOT NULL,
  `encargadoId` VARCHAR(191) NULL,
  `coincidio` BOOLEAN NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `VerificacionIdentidadIntento_entradaId_createdAt_idx` (`entradaId`, `createdAt`),
  KEY `VerificacionIdentidadIntento_eventoId_createdAt_idx` (`eventoId`, `createdAt`),
  KEY `VerificacionIdentidadIntento_encargadoId_idx` (`encargadoId`),
  CONSTRAINT `VerificacionIdentidadIntento_entradaId_fkey` FOREIGN KEY (`entradaId`) REFERENCES `Entrada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VerificacionIdentidadIntento_encargadoId_fkey` FOREIGN KEY (`encargadoId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE `Entrada` SET `titularEstado` = 'ASIGNADA' WHERE `titularId` IS NOT NULL AND `titularEstado` = 'SIN_ASIGNAR';

CREATE INDEX `Entrada_titularEstado_idx` ON `Entrada`(`titularEstado`);
