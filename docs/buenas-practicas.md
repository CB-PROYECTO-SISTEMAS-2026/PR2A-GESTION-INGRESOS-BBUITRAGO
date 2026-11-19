# Buenas prácticas del equipo PR2A (integración — Actividad 8)

Este documento consolida mejoras verificables que integran al menos tres aspectos de la tercera actividad de autoaprendizaje.

## Aspectos integrados

| Aspecto | Evidencia en el proyecto |
|---|---|
| Control de cambios (ramas y commits) | Rama `docs-mejora-proyecto` con commits `docs:` / `test:` |
| Revisión colaborativa (Pull Request) | PR hacia `Torquato` con solicitud de revisión a otro integrante |
| Documentación de seguridad | `docs/informe-seguridad.md` |
| Definición de permisos | `docs/matriz-permisos.md` |
| Trazabilidad de cambios | `docs/trazabilidad-historial.md` |
| Pruebas con asistencia de IA | `docs/actividad7/` (validación de fechas de evento) |

## Prácticas que el equipo adoptará el resto del semestre

1. **Trabajo exclusivo en ramas de módulo** (`Torquato`, etc.) y Merge/PR hacia la rama de integración acordada; nunca push directo a `main`.
2. **Revisión por pares** antes de integrar cambios que toquen API, esquema Prisma o flujos de pago/entradas.
3. **Secretos fuera de Git:** solo `.env.example`; rotación si hay sospecha de filtración.
4. **Cambios de esquema en Aiven** solo con SQL acordado y ejecutado por quien administra la base (sin `db push` destructivo).
5. **Pruebas unitarias** para reglas de negocio pequeñas (validaciones, cálculos) antes de confiar solo en pruebas manuales.
6. **Commits descriptivos** que expliquen el *porqué* (`fix:`, `feat:`, `docs:`).

## Conclusión

Adoptar estas prácticas reduce conflictos entre módulos (A–E), protege la base compartida y mejora la calidad de lo entregado al docente. La combinación de ramas + PR + documentación de seguridad + pruebas pequeñas es sostenible para un equipo académico con repositorio público y base remota compartida.
