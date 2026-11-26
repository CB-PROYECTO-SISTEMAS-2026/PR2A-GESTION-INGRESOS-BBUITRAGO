-- Evidencia fotográfica al marcar un reembolso de entrada como PAGADO.
-- Seguro sobre datos existentes: solo agrega columnas nullable.
-- Correr en Aiven (MySQL) una sola vez.

ALTER TABLE `ReembolsoEntrada`
  ADD COLUMN `evidenciaUrl` VARCHAR(191) NULL,
  ADD COLUMN `pagadoAt` DATETIME(3) NULL,
  ADD COLUMN `pagadoPorId` VARCHAR(191) NULL;
