# Matriz de permisos, autenticación y autorización — Equipo PR2A

## 1. Matriz propuesta (privilegio mínimo)

| Rol | Leer repositorio | Crear ramas y commits | Revisar Pull Requests | Administrar permisos / ajustes |
|---|---|---|---|---|
| Docente / administrador | Sí | Sí (si lo requiere) | Sí | Sí |
| Líder del equipo | Sí | Sí | Sí | No necesariamente (solo si el docente lo delega) |
| Desarrollador (p. ej. Torquato — módulo B) | Sí | Sí en su rama / PRs | Puede participar | No |
| Revisor | Sí | Según tarea | Sí | No |

## 2. Permisos observados vs necesarios

| Integrante / cuenta | Permiso observado (práctica) | Permiso necesario | Ajuste propuesto |
|---|---|---|---|
| `Diego0524-afk` | Escritura en el repo (puede hacer push a `Torquato`) | Desarrollador: write en ramas de trabajo | Mantener write; sin admin |
| `DiegoTS06` | Sin permiso de push (GitHub devolvió 403) | Opcional: solo lectura, o write si se unifica identidad | Usar una sola cuenta con MFA o pedir write mínimo |
| `whoJP` (Julio Prudencio) | Historial de commits en `main` / base del proyecto; administra la BD Aiven | Líder / admin técnico de datos | Write + coordinación de esquema; no compartir credenciales de BD por chat |
| Docente / org | Control de la organización | Admin | Único con gestión de miembros y branch protection |

## 3. Autenticación multifactor (MFA)

Para proteger las cuentas del equipo:

1. Activar MFA en GitHub (Settings → Password and authentication).
2. Preferir aplicación autenticadora o llave de seguridad frente a SMS.
3. No compartir contraseñas ni códigos MFA.
4. Para automatización, usar *Personal Access Tokens* o GitHub Apps con alcance mínimo, nunca la contraseña de la cuenta.

## 4. Preguntas de reflexión

### ¿Qué diferencia existe entre autenticación y autorización?

- **Autenticación:** demuestra *quién eres* (inicio de sesión con usuario/contraseña + MFA, o token).
- **Autorización:** define *qué puedes hacer* una vez autenticado (leer, escribir, administrar, aprobar PRs).

Una persona puede autenticarse correctamente y aun así no estar autorizada a hacer push a `main`.

### ¿Por qué no todos los integrantes deberían tener permisos administrativos?

Porque el privilegio de admin permite cambiar visibilidad, borrar el repo, alterar protecciones de ramas y gestionar secretos. Un error o una cuenta comprometida afectaría a todo el equipo. El principio de **mínimo privilegio** limita el daño.

### ¿Qué problema podría ocasionar compartir una cuenta de GitHub?

- Se pierde la trazabilidad (no se sabe quién hizo cada commit).
- Imposible aplicar MFA de forma segura.
- Si la cuenta se filtra, todos los repos accesibles quedan expuestos.
- Dificulta la evaluación individual en la asignatura.
