// Menú inferior de la app (T-50). Capa de PRESENTACIÓN: lo dibuja cada página con sesión
// llamando a pintarMenu(), así el HTML del menú está en un solo sitio y no copiado en 7 páginas.
// Sigue siendo una web de varias páginas: cada pestaña es un enlace normal.

import { apiEntrenoActual } from "../comunicacion/rest.js";

// Iconos de trazo en una rejilla de 24, del mismo estilo que el logo.
const ICONOS = {
  inicio: "M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z",
  rutinas: "M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01",
  entrenar: "M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11",
  progreso: "M4 20h16M5 15.5l4.5-5 4 3.5 5.5-7",
  perfil: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0",
};

// Pestañas y qué páginas pertenecen a cada una (Ejercicios cuelga de Rutinas;
// Historial, de Progreso; Perfil es la página de ajustes).
const PESTANAS = [
  { id: "inicio", texto: "Inicio", href: "/inicio.html", paginas: ["/inicio.html"] },
  { id: "rutinas", texto: "Rutinas", href: "/rutinas.html", paginas: ["/rutinas.html", "/ejercicios.html"] },
  { id: "entrenar", texto: "Entrenar", href: "/entreno.html", paginas: ["/entreno.html"] },
  { id: "progreso", texto: "Progreso", href: "/progreso.html", paginas: ["/progreso.html", "/historial.html"] },
  { id: "perfil", texto: "Perfil", href: "/ajustes.html", paginas: ["/ajustes.html"] },
];

const SVG = "http://www.w3.org/2000/svg";

function icono(trazo) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", trazo);
  svg.append(path);
  return svg;
}

// Función pura: qué pestaña corresponde a una ruta ("/historial.html" -> "progreso").
export function pestanaDe(ruta) {
  return PESTANAS.find((p) => p.paginas.includes(ruta))?.id ?? null;
}

// Dibuja el menú al final de <body> y marca la pestaña de la página actual.
export function pintarMenu(ruta = location.pathname) {
  const activa = pestanaDe(ruta);
  const menu = document.createElement("nav");
  menu.className = "menu-inferior";
  menu.setAttribute("aria-label", "Secciones de la app");
  for (const p of PESTANAS) {
    const enlace = document.createElement("a");
    enlace.href = p.href;
    enlace.dataset.pestana = p.id;
    if (p.id === "entrenar") enlace.classList.add("destacada");
    if (p.id === activa) enlace.setAttribute("aria-current", "page");
    const texto = document.createElement("span");
    texto.textContent = p.texto;
    enlace.append(icono(ICONOS[p.id]), texto);
    menu.append(enlace);
  }
  document.body.append(menu);
  document.body.classList.add("con-menu");
  avisarEntrenoEnCurso(menu);
}

// Un punto en "Entrenar" si hay un entreno a medias (se retoma al tocarla).
async function avisarEntrenoEnCurso(menu) {
  const r = await apiEntrenoActual();
  if (!r.ok || !r.datos) return;
  const entrenar = menu.querySelector('[data-pestana="entrenar"]');
  entrenar.classList.add("en-curso");
  entrenar.setAttribute("aria-label", "Entrenar (tienes un entreno en curso)");
}
