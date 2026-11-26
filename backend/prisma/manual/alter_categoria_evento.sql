-- Temáticas del evento (NO confundir con CategoriaEntrada = tipos de ticket).

CREATE TABLE IF NOT EXISTS `CategoriaEvento` (
  `id` VARCHAR(191) NOT NULL,
  `nombre` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `esMusical` BOOLEAN NOT NULL DEFAULT false,
  `orden` INTEGER NOT NULL DEFAULT 0,
  `activa` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CategoriaEvento_nombre_key`(`nombre`),
  UNIQUE INDEX `CategoriaEvento_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EventoCategoriaEvento` (
  `eventoId` VARCHAR(191) NOT NULL,
  `categoriaEventoId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`eventoId`, `categoriaEventoId`),
  INDEX `EventoCategoriaEvento_categoriaEventoId_idx`(`categoriaEventoId`),
  CONSTRAINT `EventoCategoriaEvento_eventoId_fkey`
    FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `EventoCategoriaEvento_categoriaEventoId_fkey`
    FOREIGN KEY (`categoriaEventoId`) REFERENCES `CategoriaEvento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SolicitudCategoriaEvento` (
  `solicitudId` VARCHAR(191) NOT NULL,
  `categoriaEventoId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`solicitudId`, `categoriaEventoId`),
  INDEX `SolicitudCategoriaEvento_categoriaEventoId_idx`(`categoriaEventoId`),
  CONSTRAINT `SolicitudCategoriaEvento_solicitudId_fkey`
    FOREIGN KEY (`solicitudId`) REFERENCES `SolicitudEvento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SolicitudCategoriaEvento_categoriaEventoId_fkey`
    FOREIGN KEY (`categoriaEventoId`) REFERENCES `CategoriaEvento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Spotify opcional en solicitud (mismo criterio que Evento.spotifyUrl).
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SolicitudEvento'
    AND COLUMN_NAME = 'spotifyUrl'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `SolicitudEvento` ADD COLUMN `spotifyUrl` VARCHAR(500) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
