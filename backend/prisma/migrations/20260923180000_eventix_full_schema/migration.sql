-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `documento` VARCHAR(191) NULL,
    `fechaNac` DATETIME(3) NULL,
    `preferencias` JSON NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsuarioRol` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'ORGANIZADOR', 'CLIENTE', 'JEFE_NEGOCIO', 'AYUDANTE', 'ENCARGADO_ACCESO', 'RECARGADOR', 'DEVOLUCIONES') NOT NULL,

    UNIQUE INDEX `UsuarioRol_usuarioId_role_key`(`usuarioId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `used` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffEvento` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'ORGANIZADOR', 'CLIENTE', 'JEFE_NEGOCIO', 'AYUDANTE', 'ENCARGADO_ACCESO', 'RECARGADOR', 'DEVOLUCIONES') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StaffEvento_usuarioId_eventoId_role_key`(`usuarioId`, `eventoId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SolicitudEvento` (
    `id` VARCHAR(191) NOT NULL,
    `organizadorId` VARCHAR(191) NOT NULL,
    `nombreEvento` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `ubicacion` VARCHAR(191) NOT NULL,
    `capacidad` INTEGER NULL,
    `empresa` VARCHAR(191) NULL,
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaFin` DATETIME(3) NULL,
    `mapaUrl` VARCHAR(191) NULL,
    `mapaNombre` VARCHAR(191) NULL,
    `estado` ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
    `observaciones` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evento` (
    `id` VARCHAR(191) NOT NULL,
    `solicitudId` VARCHAR(191) NULL,
    `organizadorId` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `fotoUrl` VARCHAR(191) NULL,
    `ubicacion` VARCHAR(191) NOT NULL,
    `servicios` TEXT NULL,
    `cronograma` TEXT NULL,
    `tipoAcceso` ENUM('QR_DIGITAL', 'QR_FISICO') NOT NULL DEFAULT 'QR_DIGITAL',
    `estado` ENUM('BORRADOR', 'PUBLICADO', 'FINALIZADO', 'CANCELADO') NOT NULL DEFAULT 'BORRADOR',
    `mapaUrl` VARCHAR(191) NULL,
    `capacidad` INTEGER NULL,
    `puntoRetiroManilla` VARCHAR(191) NULL,
    `horarioRetiroManilla` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Evento_solicitudId_key`(`solicitudId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FechaEvento` (
    `id` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `horaInicio` VARCHAR(191) NULL,
    `horaFin` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoriaEntrada` (
    `id` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `beneficios` TEXT NULL,
    `descuento` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `cupo` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoriaFecha` (
    `id` VARCHAR(191) NOT NULL,
    `categoriaId` VARCHAR(191) NOT NULL,
    `fechaId` VARCHAR(191) NOT NULL,
    `disponible` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `CategoriaFecha_categoriaId_fechaId_key`(`categoriaId`, `fechaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MapaHistorial` (
    `id` VARCHAR(191) NOT NULL,
    `solicitudId` VARCHAR(191) NULL,
    `eventoId` VARCHAR(191) NULL,
    `mapaUrl` VARCHAR(191) NOT NULL,
    `mapaNombre` VARCHAR(191) NULL,
    `tipo` ENUM('CREACION', 'ACTUALIZACION') NOT NULL,
    `nota` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketPool` (
    `id` VARCHAR(191) NOT NULL,
    `categoriaId` VARCHAR(191) NOT NULL,
    `codigoQr` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'GENERADO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TicketPool_codigoQr_key`(`codigoQr`),
    UNIQUE INDEX `TicketPool_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompraEntrada` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `estado` ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    `montoTotal` DECIMAL(12, 2) NOT NULL,
    `comprobanteUrl` VARCHAR(191) NULL,
    `observaciones` TEXT NULL,
    `revisadoPorId` VARCHAR(191) NULL,
    `revisadoAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompraEntradaItem` (
    `id` VARCHAR(191) NOT NULL,
    `compraId` VARCHAR(191) NOT NULL,
    `categoriaId` VARCHAR(191) NOT NULL,
    `fechaId` VARCHAR(191) NULL,
    `cantidad` INTEGER NOT NULL DEFAULT 1,
    `precioUnit` DECIMAL(10, 2) NOT NULL,
    `paraNombre` VARCHAR(191) NULL,
    `paraEmail` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PagoQR` (
    `id` VARCHAR(191) NOT NULL,
    `compraId` VARCHAR(191) NOT NULL,
    `referencia` VARCHAR(191) NULL,
    `comprobanteUrl` VARCHAR(191) NULL,
    `monto` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PagoQR_compraId_key`(`compraId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Entrada` (
    `id` VARCHAR(191) NOT NULL,
    `compraId` VARCHAR(191) NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `categoriaId` VARCHAR(191) NOT NULL,
    `fechaId` VARCHAR(191) NULL,
    `titularId` VARCHAR(191) NULL,
    `ticketPoolId` VARCHAR(191) NULL,
    `codigoQr` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `estado` ENUM('GENERADA', 'ASIGNADA', 'USADA', 'REEMBOLSADA', 'ANULADA') NOT NULL DEFAULT 'GENERADA',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Entrada_ticketPoolId_key`(`ticketPoolId`),
    UNIQUE INDEX `Entrada_codigoQr_key`(`codigoQr`),
    UNIQUE INDEX `Entrada_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReembolsoEntrada` (
    `id` VARCHAR(191) NOT NULL,
    `entradaId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `motivo` TEXT NULL,
    `estado` ENUM('SOLICITADO', 'APROBADO', 'RECHAZADO', 'PAGADO') NOT NULL DEFAULT 'SOLICITADO',
    `monto` DECIMAL(12, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReembolsoEntrada_entradaId_key`(`entradaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Credencial` (
    `id` VARCHAR(191) NOT NULL,
    `entradaId` VARCHAR(191) NOT NULL,
    `codigoQr` VARCHAR(191) NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Credencial_entradaId_key`(`entradaId`),
    UNIQUE INDEX `Credencial_codigoQr_key`(`codigoQr`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Manilla` (
    `id` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `entradaId` VARCHAR(191) NULL,
    `credencialId` VARCHAR(191) NULL,
    `codigoFisico` VARCHAR(191) NOT NULL,
    `vinculada` BOOLEAN NOT NULL DEFAULT false,
    `vinculadaAt` DATETIME(3) NULL,
    `puntoRetiroId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Manilla_entradaId_key`(`entradaId`),
    UNIQUE INDEX `Manilla_credencialId_key`(`credencialId`),
    UNIQUE INDEX `Manilla_eventoId_codigoFisico_key`(`eventoId`, `codigoFisico`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PuntoRetiroManilla` (
    `id` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `ubicacion` VARCHAR(191) NULL,
    `horario` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccesoEvento` (
    `id` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `entradaId` VARCHAR(191) NOT NULL,
    `fechaId` VARCHAR(191) NULL,
    `encargadoId` VARCHAR(191) NULL,
    `tipo` ENUM('INGRESO', 'SALIDA', 'REINGRESO') NOT NULL,
    `fotoIngresoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SaldoEvento` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `saldo` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SaldoEvento_usuarioId_eventoId_key`(`usuarioId`, `eventoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransaccionSaldo` (
    `id` VARCHAR(191) NOT NULL,
    `saldoEventoId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `operadorId` VARCHAR(191) NULL,
    `tipo` ENUM('RECARGA', 'COMPRA_PRODUCTO', 'DEVOLUCION', 'AJUSTE') NOT NULL,
    `monto` DECIMAL(12, 2) NOT NULL,
    `saldoResultante` DECIMAL(12, 2) NOT NULL,
    `estado` ENUM('COMPLETADA', 'PENDIENTE', 'ANULADA', 'ERROR') NOT NULL DEFAULT 'COMPLETADA',
    `nota` VARCHAR(191) NULL,
    `ventaId` VARCHAR(191) NULL,
    `evidenciaUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Negocio` (
    `id` VARCHAR(191) NOT NULL,
    `duenoId` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Producto` (
    `id` VARCHAR(191) NOT NULL,
    `negocioId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AyudanteNegocio` (
    `id` VARCHAR(191) NOT NULL,
    `negocioId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `jefeId` VARCHAR(191) NOT NULL,
    `rolFuncion` VARCHAR(191) NOT NULL DEFAULT 'cajero',
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AyudanteNegocio_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Venta` (
    `id` VARCHAR(191) NOT NULL,
    `negocioId` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `ayudanteId` VARCHAR(191) NOT NULL,
    `clienteId` VARCHAR(191) NULL,
    `entradaId` VARCHAR(191) NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DetalleVenta` (
    `id` VARCHAR(191) NOT NULL,
    `ventaId` VARCHAR(191) NOT NULL,
    `productoId` VARCHAR(191) NOT NULL,
    `cantidad` INTEGER NOT NULL DEFAULT 1,
    `precioUnit` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RetiroGanancias` (
    `id` VARCHAR(191) NOT NULL,
    `negocioId` VARCHAR(191) NOT NULL,
    `monto` DECIMAL(12, 2) NOT NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'SOLICITADO',
    `evidenciaUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiquidacionEvento` (
    `id` VARCHAR(191) NOT NULL,
    `eventoId` VARCHAR(191) NOT NULL,
    `montoTotal` DECIMAL(14, 2) NOT NULL,
    `estado` ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ENTREGADA') NOT NULL DEFAULT 'PENDIENTE',
    `aprobadoPorId` VARCHAR(191) NULL,
    `aprobadoAt` DATETIME(3) NULL,
    `entregadoPorId` VARCHAR(191) NULL,
    `entregadoAt` DATETIME(3) NULL,
    `evidenciaUrl` VARCHAR(191) NULL,
    `nota` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LiquidacionEvento_eventoId_key`(`eventoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Archivo` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `url` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UsuarioRol` ADD CONSTRAINT `UsuarioRol_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffEvento` ADD CONSTRAINT `StaffEvento_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffEvento` ADD CONSTRAINT `StaffEvento_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SolicitudEvento` ADD CONSTRAINT `SolicitudEvento_organizadorId_fkey` FOREIGN KEY (`organizadorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evento` ADD CONSTRAINT `Evento_solicitudId_fkey` FOREIGN KEY (`solicitudId`) REFERENCES `SolicitudEvento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evento` ADD CONSTRAINT `Evento_organizadorId_fkey` FOREIGN KEY (`organizadorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FechaEvento` ADD CONSTRAINT `FechaEvento_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoriaEntrada` ADD CONSTRAINT `CategoriaEntrada_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoriaFecha` ADD CONSTRAINT `CategoriaFecha_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `CategoriaEntrada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoriaFecha` ADD CONSTRAINT `CategoriaFecha_fechaId_fkey` FOREIGN KEY (`fechaId`) REFERENCES `FechaEvento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MapaHistorial` ADD CONSTRAINT `MapaHistorial_solicitudId_fkey` FOREIGN KEY (`solicitudId`) REFERENCES `SolicitudEvento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MapaHistorial` ADD CONSTRAINT `MapaHistorial_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketPool` ADD CONSTRAINT `TicketPool_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `CategoriaEntrada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompraEntrada` ADD CONSTRAINT `CompraEntrada_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompraEntrada` ADD CONSTRAINT `CompraEntrada_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompraEntradaItem` ADD CONSTRAINT `CompraEntradaItem_compraId_fkey` FOREIGN KEY (`compraId`) REFERENCES `CompraEntrada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompraEntradaItem` ADD CONSTRAINT `CompraEntradaItem_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `CategoriaEntrada`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PagoQR` ADD CONSTRAINT `PagoQR_compraId_fkey` FOREIGN KEY (`compraId`) REFERENCES `CompraEntrada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entrada` ADD CONSTRAINT `Entrada_compraId_fkey` FOREIGN KEY (`compraId`) REFERENCES `CompraEntrada`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entrada` ADD CONSTRAINT `Entrada_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entrada` ADD CONSTRAINT `Entrada_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `CategoriaEntrada`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entrada` ADD CONSTRAINT `Entrada_fechaId_fkey` FOREIGN KEY (`fechaId`) REFERENCES `FechaEvento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entrada` ADD CONSTRAINT `Entrada_titularId_fkey` FOREIGN KEY (`titularId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entrada` ADD CONSTRAINT `Entrada_ticketPoolId_fkey` FOREIGN KEY (`ticketPoolId`) REFERENCES `TicketPool`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReembolsoEntrada` ADD CONSTRAINT `ReembolsoEntrada_entradaId_fkey` FOREIGN KEY (`entradaId`) REFERENCES `Entrada`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReembolsoEntrada` ADD CONSTRAINT `ReembolsoEntrada_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Credencial` ADD CONSTRAINT `Credencial_entradaId_fkey` FOREIGN KEY (`entradaId`) REFERENCES `Entrada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Manilla` ADD CONSTRAINT `Manilla_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Manilla` ADD CONSTRAINT `Manilla_entradaId_fkey` FOREIGN KEY (`entradaId`) REFERENCES `Entrada`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Manilla` ADD CONSTRAINT `Manilla_credencialId_fkey` FOREIGN KEY (`credencialId`) REFERENCES `Credencial`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Manilla` ADD CONSTRAINT `Manilla_puntoRetiroId_fkey` FOREIGN KEY (`puntoRetiroId`) REFERENCES `PuntoRetiroManilla`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PuntoRetiroManilla` ADD CONSTRAINT `PuntoRetiroManilla_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccesoEvento` ADD CONSTRAINT `AccesoEvento_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccesoEvento` ADD CONSTRAINT `AccesoEvento_entradaId_fkey` FOREIGN KEY (`entradaId`) REFERENCES `Entrada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccesoEvento` ADD CONSTRAINT `AccesoEvento_fechaId_fkey` FOREIGN KEY (`fechaId`) REFERENCES `FechaEvento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccesoEvento` ADD CONSTRAINT `AccesoEvento_encargadoId_fkey` FOREIGN KEY (`encargadoId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaldoEvento` ADD CONSTRAINT `SaldoEvento_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaldoEvento` ADD CONSTRAINT `SaldoEvento_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransaccionSaldo` ADD CONSTRAINT `TransaccionSaldo_saldoEventoId_fkey` FOREIGN KEY (`saldoEventoId`) REFERENCES `SaldoEvento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransaccionSaldo` ADD CONSTRAINT `TransaccionSaldo_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransaccionSaldo` ADD CONSTRAINT `TransaccionSaldo_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransaccionSaldo` ADD CONSTRAINT `TransaccionSaldo_operadorId_fkey` FOREIGN KEY (`operadorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransaccionSaldo` ADD CONSTRAINT `TransaccionSaldo_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `Venta`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Negocio` ADD CONSTRAINT `Negocio_duenoId_fkey` FOREIGN KEY (`duenoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Negocio` ADD CONSTRAINT `Negocio_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Producto` ADD CONSTRAINT `Producto_negocioId_fkey` FOREIGN KEY (`negocioId`) REFERENCES `Negocio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AyudanteNegocio` ADD CONSTRAINT `AyudanteNegocio_negocioId_fkey` FOREIGN KEY (`negocioId`) REFERENCES `Negocio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AyudanteNegocio` ADD CONSTRAINT `AyudanteNegocio_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AyudanteNegocio` ADD CONSTRAINT `AyudanteNegocio_jefeId_fkey` FOREIGN KEY (`jefeId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Venta` ADD CONSTRAINT `Venta_negocioId_fkey` FOREIGN KEY (`negocioId`) REFERENCES `Negocio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Venta` ADD CONSTRAINT `Venta_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Venta` ADD CONSTRAINT `Venta_ayudanteId_fkey` FOREIGN KEY (`ayudanteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetalleVenta` ADD CONSTRAINT `DetalleVenta_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `Venta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetalleVenta` ADD CONSTRAINT `DetalleVenta_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `Producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RetiroGanancias` ADD CONSTRAINT `RetiroGanancias_negocioId_fkey` FOREIGN KEY (`negocioId`) REFERENCES `Negocio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiquidacionEvento` ADD CONSTRAINT `LiquidacionEvento_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiquidacionEvento` ADD CONSTRAINT `LiquidacionEvento_aprobadoPorId_fkey` FOREIGN KEY (`aprobadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiquidacionEvento` ADD CONSTRAINT `LiquidacionEvento_entregadoPorId_fkey` FOREIGN KEY (`entregadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Archivo` ADD CONSTRAINT `Archivo_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
