CREATE TABLE IF NOT EXISTS `BusquedaEventoPopular` (
  `terminoNorm` VARCHAR(120) NOT NULL,
  `termino` VARCHAR(120) NOT NULL,
  `busquedas` INT NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`terminoNorm`),
  INDEX `BusquedaEventoPopular_busquedas_updatedAt_idx` (`busquedas` DESC, `updatedAt` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BusquedaEventoReciente` (
  `id` VARCHAR(191) NOT NULL,
  `usuarioId` VARCHAR(191) NULL,
  `visitorKey` VARCHAR(64) NULL,
  `termino` VARCHAR(120) NOT NULL,
  `terminoNorm` VARCHAR(120) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `BusquedaEventoReciente_usuarioId_createdAt_idx` (`usuarioId`, `createdAt` DESC),
  INDEX `BusquedaEventoReciente_visitorKey_createdAt_idx` (`visitorKey`, `createdAt` DESC),
  CONSTRAINT `BusquedaEventoReciente_usuarioId_fkey`
    FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;