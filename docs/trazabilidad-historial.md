# Trazabilidad del historial — Actividad 6

**Repositorio:** [CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO](https://github.com/CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO)  
**Rama analizada:** `Torquato` / historial compartido con `main`

## 1. Tres commits relevantes

| # | Commit | Autor | Fecha | Descripción |
|---|---|---|---|---|
| 1 | [`e549b44`](https://github.com/CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO/commit/e549b4473058c3a984ff6237ea7701cf1932e714) | SOFTWAREFactory | 2026-09-28 | Initial commit — arranque del repositorio |
| 2 | [`dc8e11f`](https://github.com/CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO/commit/dc8e11f519f066f0156ee052b4451cdeafe85fae) | whoJP (Julio Prudencio) | 2026-09-30 | `[ADD] Proyecto base Eventix` — estructura backend/frontend |
| 3 | [`4fa56b7`](https://github.com/CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO/commit/4fa56b72fcd1cd60b8359d31d357b3055d4497ad) | Diego0524-afk | 2026-10-12 | `[ADD] Sprint 2 Módulo B` — QR, entradas y manillas |

Commit de seguimiento relacionado: [`5d34338`](https://github.com/CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO/commit/5d343385bb643c509f46edb727fa26aef1f54fde) — ajuste de timeouts de Prisma contra Aiven.

## 2. Evolución de un archivo (`README.md`)

Comando usado:

```bash
git log --follow --format="%h %ad %an %s" --date=short -- README.md
```

Resultado:

- `e549b44` (2026-09-28, SOFTWAREFactory): aparece el README inicial.
- `dc8e11f` (2026-09-30, whoJP): README del proyecto base EvenTix (logo, estructura, scripts de arranque).
- Rama `docs-mejora-proyecto` (esta actividad): se amplía con módulos del Sprint 2, flujo de contribución y enlaces a `docs/`.

## 3. Blame (líneas del README)

```bash
git blame -L 1,20 README.md
```

Las líneas 1–20 del README base se atribuyen al commit `dc8e11f` (whoJP, 2026-09-30). Eso permite saber **quién** escribió la sección de ejecución local y **en qué cambio** entró, útil si esa instrucción falla en las pruebas de instalación.

## 4. Pull Request / incidencia relacionada

- Esta misma actividad abre el Pull Request **`docs: mejorar documentación del proyecto y evidencias de GitHub`** desde `docs-mejora-proyecto` hacia `Torquato`.
- Enlace (tras publicarlo): se indicará en el informe PDF y en la descripción del PR.

Si el curso no tenía PRs previos visibles, este PR sirve como evidencia de revisión colaborativa.

## 5. Pregunta de análisis

**¿Cómo ayudaría esta información a investigar un defecto detectado durante las pruebas del sistema?**

Si una prueba falla (por ejemplo, “no se emiten entradas al aprobar una compra”), el historial permite:

1. Localizar el commit que introdujo `emitirParaCompra` (`4fa56b7`).
2. Ver con *blame* qué líneas del servicio de entradas cambiaron después (`5d34338` — timeouts).
3. Identificar al autor para pedir contexto.
4. Revisar el PR asociado y los comentarios de revisión (si existieron) antes de revertir o corregir.

Sin historial, el equipo solo podría adivinar; con trazabilidad, el defecto se acota a un cambio y una fecha concretos.
