---
type: Decisiones
title: Decisiones de diseño
description: Decisiones técnicas del Sprint 1 con su motivo y su estado.
timestamp: 2026-10-30
---

# Decisiones

Los motivos citados salen del [README](../README.md#tecnologías-por-qué-cada-una) o de un commit. Donde no hay fuente, queda un `TODO(alumno)`.

## D-01 Node, Express 5 y frontend sin build
- **Qué se decidió:** backend en Node 22 (ESM) con Express 5; frontend con HTML y JavaScript sin framework ni compilación.
- **Por qué:** el README dice "mismo idioma en front y back, sin compilar", "API REST mínima y estándar para separar las capas" y "las 2 capas se señalan a mano". No hubo un motivo especial para descartar un framework de frontend: se consultó con una IA y se buscó un stack sencillo para entender bien la estructura.
- **Estado:** vigente.

## D-02 MongoDB Atlas como base de datos
- **Qué se decidió:** MongoDB Atlas con el driver oficial, accedido solo desde `datos.js` (commit `584e105`, [PR #5](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/5)).
- **Por qué:** el README dice "BBDD real gestionada con capa gratuita". Ganó Mongo porque la propuso el profesor; también se valoró Supabase.
- **Estado:** vigente.

## D-03 Primer administrador por variable de entorno
- **Qué se decidió:** el email de `ADMIN_EMAIL` nace con rol `admin`; el resto, `usuario`.
- **Por qué:** el README dice "al no existir usuarios no hay quién lo nombre; el entorno del despliegue sí puede".
- **Estado:** vigente.

## D-04 Borrado lógico
- **Qué se decidió:** eliminar un usuario cambia su estado a `eliminado`; no se borra el documento (commit `d7b8b8e`, [PR #10](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/10)).
- **Por qué:** el README dice que así la cuenta "no puede volver a entrar (ni por OAuth) ni reutilizar el email". 
- **Estado:** vigente.

## D-05 Resend para el correo de confirmación
- **Qué se decidió:** enviar la confirmación con Resend (commit `e3bfd13`, [PR #7](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/7)).
- **Por qué:** se creyó que tenía capa gratuita utilizable; en la práctica exigía un dominio propio (ver D-06).
- **Estado:** sustituida por D-06.

## D-06 Brevo para el correo de confirmación
- **Qué se decidió:** cambiar de Resend a Brevo, por API HTTP (commit `42680ec`, [PR #10](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/10)).
- **Por qué:** el README dice "capa gratuita, remitente verificado, sin dominio ni SMTP". El cambio se hizo porque Resend necesitaba un dominio propio y Brevo no.
- **Estado:** vigente.

## D-07 OAuth con GitHub y una app por entorno
- **Qué se decidió:** login con GitHub (commit `273ad6c`, [PR #7](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/7)); el usuario OAuth nace activo, sin confirmar el correo.
- **Por qué:** el README explica que GitHub admite una sola callback exacta por app, así que hay una app por entorno. Se eligió GitHub porque llamó la atención poder hacerlo con GitHub; sin otro motivo especial.
- **Estado:** vigente.

## D-08 Segundo proveedor (Google) con una tabla de proveedores
- **Qué se decidió:** añadir Google y generalizar el flujo en la tabla `PROVEEDORES` de `api.js` (commit `26a3d1f`, [PR #10](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/10)).
- **Por qué:** el commit habla de "generalizando el flujo de proveedores". La especificación pedía "al menos un" proveedor; se añadió Google para aprender a hacerlo también con él, por ser el más usado.
- **Estado:** vigente.

## D-09 bcryptjs para el hash de contraseñas
- **Qué se decidió:** `bcryptjs`, con la versión asíncrona desde el commit `d7b8b8e`.
- **Por qué:** el README dice "hash seguro de contraseñas sin compilados nativos". La versión asíncrona se justifica en el comentario de `logica.js`: no bloquea el servidor mientras calcula el hash.
- **Estado:** vigente.

## D-10 Sesiones con express-session en memoria
- **Qué se decidió:** sesión en el servidor con `express-session` y su almacén por defecto, en memoria.
- **Por qué:** el README dice "sesión en servidor que sobrevive a recargas". No se aceptó por un motivo concreto: simplemente no se implementó que la sesión sobreviva al reinicio del servidor (sin ese almacén, se pierde al reiniciarlo).
- **Estado:** vigente.

## D-11 Pruebas con node:test contra una base de pruebas real
- **Qué se decidió:** `node:test` sin dependencias; las pruebas usan bases de pruebas en Atlas (`MONGO_DB_NAME`).
- **Por qué:** el README dice "tests sin configuración extra". No hay un motivo concreto escrito para no usar dobles de la base de datos. Las pruebas llaman a Atlas de verdad (bases `fitness_hub_test` y `fitness_hub_test_api`), por eso tardan unos segundos y necesitan la cadena de conexión.
- **Estado:** vigente.

## D-12 Despliegue en Render desde main
- **Qué se decidió:** Web Service de Render conectado al repositorio, con auto-deploy desde `main` ([README](../README.md#cicd)).
- **Por qué:** lo recomendó una IA; es gratis y de momento funciona bien.
- **Estado:** vigente.

## D-13 Endpoint público de la prueba técnica
- **Qué se decidió:** `POST /api/prueba/estado` expone `calcularEstado` sin sesión (commit `b791b1c`, [PR #9](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/9)).
- **Por qué:** lo pedía la prueba técnica (variante 6). Se mantiene para que quede constancia, por si acaso, aunque la prueba ya terminó.
- **Estado:** vigente.
