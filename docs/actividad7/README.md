# Actividad 7 — Asistencia con IA (declaración de herramienta)

**Herramienta utilizada:** Cursor (asistente de IA en el IDE). No se dispuso de GitHub Copilot en esta sesión; el enunciado permite un asistente de IA disponible.

> Nota: el módulo de Microsoft Learn ejemplifica Copilot con Python. En este equipo no hay intérprete Python instalado, así que la implementación y las pruebas se hicieron en **JavaScript (Node.js)**, el runtime ya usado por EvenTix. Se conservan también borradores `.py` por si se ejecutan en otro entorno.

## Función elegida

Validar el **rango de fechas de un evento** (`fecha_inicio` ≤ `fecha_fin`; la inicio no puede ser anterior a “hoy”). Regla alineada con la creación de eventos en EvenTix.

## Prompt utilizado

```text
Necesito una función para EvenTix que valide el rango de fechas de un evento:
recibe fechaInicio y fechaFin (YYYY-MM-DD) y fechaReferencia (hoy).
Debe devolver { ok: boolean, mensaje: string }. Reglas:
1) fechaInicio <= fechaFin
2) fechaInicio >= fechaReferencia (no eventos que empiecen en el pasado)
Incluye pruebas unitarias y al menos un caso límite
(inicio == fin; inicio un día antes de hoy).
```

## Archivos

| Archivo | Descripción |
|---|---|
| `validarFechaEvento.js` | Versión final revisada |
| `test_validarFechaEvento.js` | Pruebas con `assert` de Node |
| `validar_fecha_evento.py` / `test_validar_fecha_evento.py` | Equivalente en Python (referencia) |

## Cómo ejecutar las pruebas

```bash
node docs/actividad7/test_validarFechaEvento.js
```

## Decisiones de revisión del código propuesto

1. Se normalizó a fechas UTC `YYYY-MM-DD` para evitar desfaces por zona horaria del sistema.
2. Se rechazan cadenas con formato incorrecto (p. ej. `19/11/2026`).
3. Evento de un solo día (`inicio === fin`) se acepta explícitamente.
4. Los mensajes quedaron en español, coherentes con la UI del proyecto.

## Caso límite

- `inicio == fin` → válido (evento de un día).
- `inicio = ayer` → inválido.

## Reflexión

- **Ventajas:** la IA acelera el esqueleto de la función y sugiere casos de prueba.
- **Limitaciones:** no conoce solas las reglas de “editar un evento ya publicado”; hace falta revisión humana y pruebas contra la API NestJS.
