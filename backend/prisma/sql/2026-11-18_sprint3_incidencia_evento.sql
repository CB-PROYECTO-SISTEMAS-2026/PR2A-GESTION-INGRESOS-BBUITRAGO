CREATE TABLE IF NOT EXISTS IncidenciaEvento (
 id VARCHAR(191) NOT NULL PRIMARY KEY,
 eventoId VARCHAR(191) NOT NULL,
 autorId VARCHAR(191) NOT NULL,
 clave VARCHAR(191) NOT NULL,
 descripcion VARCHAR(500) NOT NULL,
 resolucion VARCHAR(500), resueltaPorId VARCHAR(191), resueltaAt DATETIME(3),
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY IncidenciaEvento_eventoId_autorId_clave_key (eventoId, autorId, clave),
 INDEX IncidenciaEvento_eventoId_createdAt_idx (eventoId, createdAt),
 FOREIGN KEY (eventoId) REFERENCES Evento(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
