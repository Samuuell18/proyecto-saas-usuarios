# Fitness Hub — base SaaS con gestión de usuarios

Proyecto de Procesos de Ingeniería del Software (curso 26-27).
MVP futuro: crear rutinas → entrenar → registrar → consultar el progreso.
Este Sprint 1 construye solo la base: usuarios, sesión y capas (sin rutinas todavía).

## Arquitectura

- El backend sirve el frontend (mismo origen). El cliente nunca toca la BBDD
  ni ejecuta lógica de negocio; habla con el servidor solo vía API.
- Backend en 3 capas: `servidor/api.js` (rutas HTTP) → `servidor/logica.js`
  (reglas de negocio) → `servidor/datos.js` (único que toca la BBDD vía `bd.js`).
- Frontend en 2 capas: `cliente/index.html + controlador.js + inicio.js` (GUI)
  y `cliente/rest.js` (único que hace `fetch` a la API).
- BBDD externa `mi_bbdd`: MongoDB Atlas (bases `fitness_hub` y `fitness_hub_test`).
- Estados de cuenta: `pendiente` (sin login) → `activo` → `eliminado` (sin login).

## Tecnologías (por qué cada una)

- **Node 22 ESM:** mismo idioma en front y back, sin compilar.
- **Express 5:** API REST mínima y estándar para separar las capas.
- **Frontend vanilla:** sin build; las 2 capas se señalan a mano.
- **MongoDB Atlas:** BBDD real gestionada con capa gratuita.
- **bcryptjs:** hash seguro de contraseñas sin compilados nativos.
- **express-session:** sesión en servidor que sobrevive a recargas.
- **dotenv:** secretos en `.env` (el repo solo lleva `.env.example`).
- **node:test nativo:** tests sin configuración extra.

## Cómo correr en local

```
npm install
npm run dev   # http://localhost:3000
```

## Cómo correr los tests

```
npm test                          # todos (usan fitness_hub_test)
npm test -- test/logica.test.js   # un solo fichero
```

## Variables de entorno (solo nombres)

```
PORT=
SESSION_SECRET=
MONGODB_URI=
MONGO_DB_NAME=
```

## Cómo entrar como admin

El primer admin se crea por variable de entorno (decisión justificada: al no
existir usuarios no hay quién lo nombre; el entorno del despliegue sí puede).
Pon `ADMIN_EMAIL=tu@email.com` en el `.env`, regístrate con ese email, actívalo
y nacerá con `rol: admin`. El resto de registros nacen `usuario`.
Las credenciales de prueba se envían aparte, nunca en el repo.

## Confirmación por email (T-21)

Al registrarse se guarda un token de un solo uso y se manda el enlace
`APP_URL/api/confirmar?token=...` con Resend (servicio transaccional con capa
gratuita, por API, sin SMTP). Sin confirmar no hay login; OAuth nace activo.
Al probar, mira también el spam. Sin `RESEND_API_KEY` el enlace sale por el log
(solo desarrollo y tests).

## OAuth con GitHub (T-20)

GitHub admite UNA callback exacta por OAuth App, así que hay una app por entorno:

1. **Local:** Settings → Developer settings → OAuth Apps → New. Homepage
   `http://localhost:3000`, callback `http://localhost:3000/api/oauth/github/callback`.
2. **Producción:** otra app igual con tu URL pública y su callback exacta
   (`https://tu-app.onrender.com/api/oauth/github/callback`).
3. Pon en cada entorno sus claves: `APP_URL`, `GITHUB_CLIENT_ID` y
   `GITHUB_CLIENT_SECRET`. El usuario OAuth nace activo y entra a `/inicio.html`.
