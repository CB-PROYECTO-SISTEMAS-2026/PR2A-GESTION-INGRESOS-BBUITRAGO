/**
 * Configuración de Jest para las pruebas de Eventix.
 *
 * Las pruebas importan el código real del backend (../backend/src). Las librerías que ese código
 * usa (NestJS, class-validator, Prisma...) se resuelven desde ../backend/node_modules, así se usa
 * exactamente la misma versión que en producción y no se duplican dependencias aquí.
 */
const path = require('path');

const backendModules = path.resolve(__dirname, '../backend/node_modules');

const tsJest = ['ts-jest', { tsconfig: path.resolve(__dirname, 'tsconfig.json') }];

/** Configuración común a todos los proyectos de pruebas. */
const base = {
  rootDir: __dirname,
  testEnvironment: 'node',
  // Algunos paquetes de NestJS (jwt, config, passport, mapped-types) solo se publican como
  // módulos ESM: se convierten a CommonJS para que Jest pueda cargarlos.
  transform: { '^.+\\.(ts|js)$': tsJest },
  transformIgnorePatterns: [
    'node_modules[\\\\/](?!@nestjs[\\\\/](jwt|config|passport|mapped-types)[\\\\/])',
  ],
  moduleDirectories: ['node_modules', backendModules],
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: ['<rootDir>/unit/**/*.test.ts'],
    },
    {
      // Usan la base de datos compartida: correr SIEMPRE con --runInBand (un archivo a la vez),
      // como hacen los scripts de package.json.
      ...base,
      displayName: 'integracion',
      testMatch: ['<rootDir>/integracion/**/*.test.ts'],
      setupFiles: ['<rootDir>/integracion/helpers/entorno.js'],
      // Cada consulta a Aiven tarda ~180 ms: las pruebas necesitan más de los 5 s por defecto.
      setupFilesAfterEnv: ['<rootDir>/integracion/helpers/tiempo.js'],
    },
  ],
};
