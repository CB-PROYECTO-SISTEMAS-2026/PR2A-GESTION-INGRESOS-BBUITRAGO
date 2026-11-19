<p align="center">
  <img src="assets/EventixLogo.png" alt="EvenTix" width="360" />
</p>

# EvenTix

Proyecto de **Sistemas II** (equipo PR2A). Plataforma para la gestión de eventos: solicitudes de organizadores, publicación de eventos, compra y emisión de entradas (QR digital o manilla física), control de acceso, billetera y puntos de venta dentro del evento.

| Dato | Valor |
|---|---|
| Repositorio | [CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO](https://github.com/CB-PROYECTO-SISTEMAS-2026/PR2A-GESTION-INGRESOS-BBUITRAGO) |
| Rama de trabajo del equipo Torquato | `Torquato` |
| Rama `main` | Solo integración; **no** se suben cambios directos a `main` |

## Estructura

```
Eventix/
├── assets/     Logo e imagen por defecto de eventos
├── backend/    API REST (NestJS + Prisma + MySQL)
├── docs/       Guías de colaboración, seguridad e InnerSource
└── frontend/   Aplicación web (React + Vite + Tailwind)
```

## Módulos del Sprint 2 (resumen)

| Módulo | Responsabilidad | Estado en rama Torquato |
|---|---|---|
| A | Compra de entradas y verificación de pagos | Pendiente de integración |
| B | Generación de QR y vinculación de manillas (HU-014, HU-055, HU-053, HU-015) | Implementado |
| C | Control de acceso y verificación fotográfica | Pendiente |
| D | Recarga de billetera | Pendiente |
| E | Consumo en puntos de venta | Pendiente |

### Módulo B (rama Torquato)

- Emisión de entradas con QR único al aprobar una compra (`EntradasService.emitirParaCompra`).
- QR digital asignado al perfil en eventos `QR_DIGITAL` / `AMBOS` (página **Mis entradas**).
- Puntos de entrega de manillas y asignación de supervisores (admin).
- Vinculación de manilla física por el supervisor (`ENCARGADO_ACCESO`).

## Ejecución local

Backend (ver `backend/README.md` y `backend/.env.example`):

```bash
cd backend
npm install
# Copia .env.example → .env y completa DATABASE_URL, JWT_SECRET, Cloudinary y correo.
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

Frontend (ver `frontend/.env.example`):

```bash
cd frontend
npm install
# Copia .env.example → .env (VITE_API_URL=http://127.0.0.1:3000/api)
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:3000/api  

## Flujo de contribución del equipo

1. Trabajar siempre desde la rama del integrante / módulo (`Torquato`, etc.), nunca directamente sobre `main`.
2. Para cambios documentales o de revisión, crear una rama corta (ejemplo: `docs-mejora-proyecto`).
3. Hacer commits descriptivos (`docs: …`, `fix: …`, `feat: …`).
4. Abrir un Pull Request hacia la rama base acordada y pedir revisión a otro integrante.
5. No subir secretos (`.env`, certificados privados, tokens).

Documentación adicional en `docs/`:

- [Guía de reutilización (InnerSource)](docs/guia-reutilizacion.md)
- [Informe de seguridad del repositorio](docs/informe-seguridad.md)
- [Matriz de permisos](docs/matriz-permisos.md)
- [Trazabilidad del historial](docs/trazabilidad-historial.md)
- [Buenas prácticas del equipo](docs/buenas-practicas.md)
