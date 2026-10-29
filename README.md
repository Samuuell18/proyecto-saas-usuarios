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
  Eliminar es un borrado lógico: la cuenta se queda guardada como `eliminado`,
  así que no puede volver a entrar (ni por OAuth) ni reutilizar el email, y su
  sesión abierta deja de valer en la siguiente petición.

## Tecnologías (por qué cada una)

- **Node 22 ESM:** mismo idioma en front y back, sin compilar.
- **Express 5:** API REST mínima y estándar para separar las capas.
- **Frontend vanilla:** sin build; las 2 capas se señalan a mano.
- **MongoDB Atlas:** BBDD real gestionada con capa gratuita.
- **Driver `mongodb` oficial:** habla con Atlas solo desde `datos.js`.
- **Brevo:** email transaccional por API (capa gratuita, remitente verificado, sin dominio ni SMTP).
- **OAuth con GitHub:** login externo con nace-activo y callbacks exactas.
- **bcryptjs:** hash seguro de contraseñas sin compilados nativos.
- **express-session:** sesión en servidor que sobrevive a recargas.
- **dotenv:** secretos en `.env` (el repo solo lleva `.env.example`).
- **node:test nativo:** tests sin configuración extra.

## Cómo correr en local

Requisitos: Node 22 o superior y una cadena de conexión a MongoDB Atlas.

```
npm install
cp .env.example .env   # y rellena los valores (como mínimo MONGODB_URI y SESSION_SECRET)
npm run dev            # http://localhost:3000
```

Sin `BREVO_API_KEY` el enlace de confirmación aparece en la terminal;
sin las variables de GitHub, el botón de OAuth responde 501.

## Cómo correr los tests

```
npm test                          # todos (usan fitness_hub_test)
npm test -- test/logica.test.js   # un solo fichero
```

Necesitan `MONGODB_URI` en el `.env` (en el CI, el secreto `MONGODB_URI`).
Hay tests de la lógica (`test/logica.test.js`), de la API real con sus
códigos 401/403/404 (`test/api.test.js`) y de la prueba técnica
(`test/variante6.test.js`).

## API

| Ruta | Acceso | Respuestas |
|---|---|---|
| `POST /api/registro` | público | 201 · 400 · 409 |
| `POST /api/login` | público | 200 · 401 · 403 (pendiente) |
| `GET /api/confirmar?token=` | público | redirige a `/` |
| `POST /api/logout` | sesión | 200 |
| `GET /api/yo` | sesión | 200 · 401 |
| `GET /api/usuarios` | admin | 200 · 401 · 403 |
| `GET /api/usuarios/:email/activo` | admin | 200 · 401 · 403 |
| `DELETE /api/usuarios/:email` | admin a cualquiera; usuario solo a sí mismo (borrado lógico) | 200 · 401 · 403 · 404 |
| `GET /api/oauth/github` y `/callback` | público | redirección · 400 · 403 · 501 |
| `POST /api/prueba/estado` | público | 200 · 400 (prueba técnica, variante 6) |

## Variables de entorno (solo nombres)

```
PORT=
SESSION_SECRET=
MONGODB_URI=
MONGO_DB_NAME=
ADMIN_EMAIL=
APP_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
BREVO_API_KEY=
EMAIL_FROM=   # remitente verificado en Brevo
```

En producción (`npm start`, despliegue en Render desde `main`) las pone la
plataforma; en local van en tu `.env`.

## CI/CD

- **CI (GitHub Actions, `.github/workflows/ci.yml`):** en cada pull request y en
  cada push a `main` instala dependencias (`npm ci`) y ejecuta `npm test` con
  Node 22. La cadena de Atlas llega por el secreto `MONGODB_URI` del repositorio.
  No se fusiona un PR con el CI en rojo.
- **CD (Render):** Web Service conectado a este repositorio con auto-deploy
  desde `main`. Build `npm install`, arranque `npm start`. Las variables de
  entorno se configuran en el panel de Render, nunca en el repo. Cada merge a
  `main` se despliega solo, sin pasos manuales.

## Despliegue y entrega (Sprint 1)

- Repositorio: `https://github.com/Samuuell18/proyecto-saas-usuarios`
- Prototipo desplegado: `https://proyecto-saas-usuarios.onrender.com`
  (capa gratuita de Render: la primera petición tras un rato inactiva tarda en arrancar).
- Se entrega como hecho el último commit de `main` anterior a la fecha límite.

## Cómo entrar como admin

El primer admin se crea por variable de entorno (decisión justificada: al no
existir usuarios no hay quién lo nombre; el entorno del despliegue sí puede).
Pon `ADMIN_EMAIL=tu@email.com` en el `.env`, regístrate con ese email, actívalo
y nacerá con `rol: admin`. El resto de registros nacen `usuario`.
Las credenciales de prueba se envían aparte, nunca en el repo.

## Confirmación por email (T-21)

Al registrarse se guarda un token de un solo uso y se manda el enlace
`APP_URL/api/confirmar?token=...` con Brevo (servicio transaccional con capa
gratuita, por API, sin SMTP; el remitente `EMAIL_FROM` se verifica en Brevo). Sin confirmar no hay login; OAuth nace activo.
Al probar, mira también el spam. Sin `BREVO_API_KEY` el enlace sale por el log
(solo desarrollo y tests).

> Para la evaluación en producción sin correo: el revisor se registra y el
> admin activa la cuenta editando `estado` a `activo` en Atlas
> (`Browse Collections → fitness_hub → usuarios`).

## OAuth con GitHub (T-20)

GitHub admite UNA callback exacta por OAuth App, así que hay una app por entorno:

1. **Local:** Settings → Developer settings → OAuth Apps → New. Homepage
   `http://localhost:3000`, callback `http://localhost:3000/api/oauth/github/callback`.
2. **Producción:** otra app igual con tu URL pública y su callback exacta
   (`https://tu-app.onrender.com/api/oauth/github/callback`).
3. Pon en cada entorno sus claves: `APP_URL`, `GITHUB_CLIENT_ID` y
   `GITHUB_CLIENT_SECRET`. El usuario OAuth nace activo y entra a `/inicio.html`.
