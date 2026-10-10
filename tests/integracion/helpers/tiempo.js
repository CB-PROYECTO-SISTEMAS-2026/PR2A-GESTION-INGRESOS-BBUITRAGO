/**
 * Tiempo máximo por prueba de integración (y por beforeAll/afterAll).
 *
 * La base compartida de Aiven responde en ~180 ms por consulta: crear el escenario o hacer varios
 * cobros simultáneos tarda varios segundos, más que los 5 s que Jest permite por defecto.
 * (Jest no acepta `testTimeout` dentro de un proyecto; por eso se fija aquí con setupFilesAfterEnv.)
 */
jest.setTimeout(120_000);
