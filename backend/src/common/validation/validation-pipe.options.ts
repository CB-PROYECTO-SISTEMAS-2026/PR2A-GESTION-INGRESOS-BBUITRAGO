import type { ValidationPipeOptions } from '@nestjs/common';

/**
 * Opciones del ValidationPipe global (main.ts). Están aparte para que las pruebas automatizadas
 * (tests/unit) validen los DTO con exactamente la misma configuración que la API.
 */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  stopAtFirstError: true,
  transformOptions: { enableImplicitConversion: true },
};
