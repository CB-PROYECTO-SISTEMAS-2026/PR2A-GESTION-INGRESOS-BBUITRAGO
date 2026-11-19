# Guía de reutilización (InnerSource) — EvenTix

Esta guía aplica prácticas de colaboración de código abierto **dentro** de la organización del curso (InnerSource): un artefacto del equipo PR2A queda disponible para otros equipos de Sistemas II sin datos confidenciales.

## 1. Recurso compartible

| Campo | Valor |
|---|---|
| Nombre | Plantilla de guía de instalación local + checklist de seguridad mínima |
| Ubicación | Este archivo + secciones de `README.md` y `docs/informe-seguridad.md` |
| Audiencia | Otros equipos del curso que usen NestJS + React + Prisma + MySQL |
| Qué NO incluye | Credenciales reales (`.env`), certificados SSL privados, datos de usuarios de producción |

### Contenido reutilizable

1. Estructura de carpetas `backend/` / `frontend/` / `docs/`.
2. Checklist de variables de entorno a partir de `.env.example` (nunca del `.env` real).
3. Flujo de ramas: trabajar fuera de `main`, Pull Request y revisión.
4. Checklist de seguridad mínima (visibilidad, secretos, protección de `main`).

## 2. Instrucciones de uso para otro equipo

1. Copia este archivo a `docs/guia-reutilizacion.md` de tu repositorio (o haz fork y adapta).
2. Sustituye el nombre del producto, las ramas del equipo y los módulos por los tuyos.
3. Verifica que tu `.gitignore` ignore `.env`, `*.pem` privados y carpetas `dist/` / `node_modules/`.
4. Publica solo `.env.example` con valores ficticios.
5. Si reutilizas el checklist de seguridad, vuelve a evaluarlo contra **tu** repositorio (visibilidad y permisos pueden diferir).

### Ejemplo de adaptación

```md
# Guía de reutilización — <Nombre de tu sistema>
...
| Rama de trabajo | <NombreDeTuRama> |
```

## 3. Reglas para proponer modificaciones

1. Toda mejora se hace en una rama (`docs/...` o `chore/...`), nunca directo a `main`.
2. Abrir un Pull Request con:
   - título descriptivo (`docs: clarificar checklist de instalación`);
   - descripción del problema y del cambio;
   - captura o enlace si afecta a una guía visual.
3. Al menos **un revisor** del equipo dueño del artefacto debe aprobar antes de integrar.
4. No se aceptan PRs que introduzcan secretos, datos personales reales o enlaces a bases de datos privadas.
5. Los cambios de alcance (nuevo artefacto, cambio de licencia, borrado de secciones) requieren acuerdo del líder del equipo dueño.

## 4. Responsables de revisión y mantenimiento

| Rol | Responsabilidad | Contacto / cuenta (equipo PR2A) |
|---|---|---|
| Dueño del artefacto | Acepta o rechaza cambios a esta guía | Diego Torquato (`Diego0524-afk`) — módulo B |
| Revisor secundario | Segunda mirada en PRs de documentación | Integrante del equipo asignado en el PR |
| Administrador del repo | Permisos, protección de ramas, secretos | Organización `CB-PROYECTO-SISTEMAS-2026` / docente |

### Ciclo de mantenimiento

- Revisión mínima: cada sprint o cuando cambie el flujo de instalación.
- Si un equipo externo propone un cambio útil, se discute en el PR y se documenta la decisión en la descripción del merge.

## 5. Relación con InnerSource

InnerSource permite que varios equipos del curso:

- reutilicen plantillas sin reinventar la instalación;
- contribuyan mejoras mediante Pull Requests;
- mantengan un dueño claro del artefacto, como en un proyecto open source, pero dentro de la organización académica.
