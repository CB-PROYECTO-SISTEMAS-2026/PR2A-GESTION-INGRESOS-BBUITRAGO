<p align="center">
  <img src="assets/EventixLogo.png" alt="EvenTix" width="360" />
</p>

# EvenTix

Proyecto de Sistemas II. Plataforma para la gestión de eventos: solicitudes de organizadores,
publicación de eventos, entradas y negocios dentro del evento.

## Estructura

```
Eventix/
├── assets/     Logo e imagen por defecto de eventos (originales)
├── backend/    API REST (NestJS + Prisma + MySQL en Aiven)
└── frontend/   Aplicación web (React + Vite + Tailwind)
```

## Ejecución local

Backend (ver `backend/README.md` para la configuración del `.env`, el certificado `ca.pem` y las
reglas de la base compartida):

```bash
cd backend
npm install
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

- App: `http://localhost:5173`
- API: `http://localhost:3000/api`
