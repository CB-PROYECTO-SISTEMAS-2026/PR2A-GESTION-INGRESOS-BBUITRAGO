const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'CORS_ORIGINS',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_USER',
  'MAIL_PASS',
  'MAIL_FROM',
] as const;

const INSECURE_JWT_SECRETS = ['eventix_dev_jwt_secret_change_in_production', 'changeme', 'secret'];

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED.filter((key) => !String(config[key] ?? '').trim());
  if (missing.length) {
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}. Revisa backend/.env.example.`);
  }

  const jwtSecret = String(config.JWT_SECRET);
  if (jwtSecret.length < 32 || INSECURE_JWT_SECRETS.includes(jwtSecret)) {
    throw new Error('JWT_SECRET debe ser aleatorio y tener al menos 32 caracteres.');
  }

  if (Number.isNaN(Number(config.MAIL_PORT))) {
    throw new Error('MAIL_PORT debe ser numérico.');
  }

  return config;
}
