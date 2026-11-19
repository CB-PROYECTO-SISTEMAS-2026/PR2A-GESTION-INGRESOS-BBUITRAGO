# Informe de seguridad del repositorio — EvenTix (PR2A)

**Repositorio examinado:** [CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO](https://github.com/CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO)  
**Fecha de revisión:** 19/11/2026  
**Alcance:** configuración visible sin modificar ajustes administrativos del docente ni publicar secretos.

## Lista de verificación

### 1. Visibilidad

| Campo | Detalle |
|---|---|
| Estado observado | El repositorio es **público** (`visibility=public`). |
| Riesgo | El código fuente y la documentación quedan visibles para cualquiera. Si alguien subiera un `.env` o un certificado, quedaría expuesto de inmediato. |
| Acción recomendada | Mantener el código público solo si el docente lo exige. Reforzar `.gitignore` y revisar historial antes de cada push. Valorar repositorio privado cuando haya datos reales de clientes. |

### 2. Accesos

| Campo | Detalle |
|---|---|
| Estado observado | Colaboración vía organización `CB-PROYECTO-SISTEMAS-2026`. En la práctica, no todos los integrantes tienen el mismo nivel de escritura (por ejemplo, una cuenta personal no pudo hacer push y se usó otra con permiso). |
| Riesgo | Cuentas con más privilegios de los necesarios; o cuentas sin MFA que, si se filtran, permiten alterar el código. |
| Acción recomendada | Aplicar privilegio mínimo: `write` solo a quienes desarrollan; `admin` solo a líder/docente. Habilitar MFA en todas las cuentas. |

### 3. Rama principal (`main`)

| Campo | Detalle |
|---|---|
| Estado observado | El equipo trabaja en ramas por integrante (`Torquato`, etc.). La regla documentada es **no** cambiar `main` directamente. No se verificó desde esta cuenta si GitHub tiene *branch protection rules* activas (requiere permiso de administración). |
| Riesgo | Sin protección formal, alguien con `write` podría hacer push a `main` y saltarse la revisión. |
| Acción recomendada | Activar protección de `main`: exigir Pull Request, al menos 1 aprobación y checks verdes. Prohibir force-push. |

### 4. Pull Requests

| Campo | Detalle |
|---|---|
| Estado observado | Se usan ramas y commits descriptivos. Esta actividad crea el PR `docs-mejora-proyecto` → `Torquato` para practicar revisión. |
| Riesgo | Integrar sin revisión deja pasar errores o secretos. |
| Acción recomendada | Política de equipo: ningún merge a la rama de integración sin al menos un revisor distinto del autor. |

### 5. Secretos

| Campo | Detalle |
|---|---|
| Estado observado | Existen `backend/.env.example` y `frontend/.env.example` (seguros). `.env` está en `.gitignore`. El certificado `backend/prisma/ca.pem` (CA pública de Aiven) se mantiene fuera del control de versiones en la copia local. |
| Riesgo | Históricamente se compartieron credenciales por canales no versionados; si alguien las subiera al repo público, el impacto sería alto (base Aiven, Cloudinary, correo). |
| Acción recomendada | Rotar secretos si se sospecha exposición. Usar GitHub Secrets / variables de entorno en CI. Nunca pegar contraseñas reales en issues, PRs o chats del curso. |

### 6. Dependencias

| Campo | Detalle |
|---|---|
| Estado observado | Backend con NestJS 11, Prisma 6, etc. (ver `backend/package.json`). No hay evidencia de Dependabot o auditoría periódica documentada en el repo. |
| Riesgo | Dependencias con vulnerabilidades conocidas (XSS, prototype pollution, etc.). |
| Acción recomendada | Activar Dependabot o ejecutar `npm audit` en cada sprint. Actualizar paquetes críticos con PR dedicado. |

### 7. Copias de seguridad / recuperación

| Campo | Detalle |
|---|---|
| Estado observado | El código está en GitHub (remoto). La base de datos compartida está en Aiven (gestión externa). |
| Riesgo | Pérdida de trabajo no pusheado; corrupción o borrado accidental en la base compartida. |
| Acción recomendada | Push frecuente a la rama del equipo. Acordar con el dueño de Aiven backups y **no** usar `prisma db push` / `migrate deploy` a ciegas en la base compartida. |

## Tres recomendaciones prioritarias (justificadas)

1. **Proteger `main` con reglas de Pull Request.** Evita que un push accidental o malicioso rompa la línea base del curso.
2. **Rotar y aislar secretos.** El proyecto usa servicios externos; una filtración en un repo público compromete a todo el equipo.
3. **Revisión obligatoria + Dependabot.** Combina calidad de código (Actividad 2) con reducción de vulnerabilidades en dependencias.

## Nota ética

No se publicaron secretos para demostrar vulnerabilidades ni se modificó la configuración administrativa del repositorio del docente.
