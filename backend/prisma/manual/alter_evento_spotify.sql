-- Enlace Spotify opcional para "Conocé al artista" en la ficha pública.
-- Seguro sobre datos existentes: solo agrega columna nullable.
-- Correr en Aiven (MySQL) una sola vez.

ALTER TABLE `Evento`
  ADD COLUMN `spotifyUrl` VARCHAR(500) NULL;
