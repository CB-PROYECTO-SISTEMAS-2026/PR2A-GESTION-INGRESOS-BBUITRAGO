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

module.exports = {
  projects: [
    {
      displayName: 'unit',
      rootDir: __dirname,
      testEnvironment: 'node',
      testMatch: ['<rootDir>/unit/**/*.test.ts'],
      // Algunos paquetes de NestJS (jwt, config, passport, mapped-types) solo se publican como
      // módulos ESM: se convierten a CommonJS para que Jest pueda cargarlos.
      transform: { '^.+\\.(ts|js)$': tsJest },
      transformIgnorePatterns: [
        'node_modules[\\\\/](?!@nestjs[\\\\/](jwt|config|passport|mapped-types)[\\\\/])',
      ],
      moduleDirectories: ['node_modules', backendModules],
    },
  ],
};
