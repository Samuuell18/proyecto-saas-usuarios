// Gráficos de la página de progreso (T-48). Capa de PRESENTACIÓN, sin librerías: se dibujan
// en SVG a mano (D-25). Arriba, las cuentas puras de las escalas (probadas con node:test);
// abajo, las funciones que crean el SVG (solo funcionan en el navegador).

const ANCHO = 360; // tamaño del dibujo (viewBox); en pantalla se estira al ancho disponible
const ALTO = 200;
const MARGEN = { arriba: 12, derecha: 12, abajo: 28, izquierda: 40 };
const SVG = "http://www.w3.org/2000/svg";

// ---------- Cuentas puras ----------

// El valor "redondo" más pequeño que sea >= max, para que el eje acabe en un número limpio:
// 3 -> 3, 7 -> 8, 132 -> 150, 800 -> 800, 1234 -> 1500. Sin datos (0), 1.
export function techoBonito(max) {
  if (!(max > 0)) return 1;
  const potencia = 10 ** Math.floor(Math.log10(max));
  const pasos = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const paso = pasos.find((p) => p * potencia >= max - 1e-9);
  return Number((paso * potencia).toPrecision(12)); // quita restos como 1.2000000000000002
}

// Las tres marcas del eje vertical: 0, la mitad y el techo.
export function marcasEje(techo) {
  return [0, techo / 2, techo];
}

// Para contar cosas enteras (entrenos) el techo tiene que ser par: así la mitad también es
// entera y no sale "0,5 entrenos". 1 -> 2, 3 -> 4, 8 -> 8.
export function techoEntero(max) {
  const techo = Math.max(2, Math.ceil(techoBonito(max)));
  return techo % 2 === 0 ? techo : techo + 1;
}

// Altura (coordenada y del SVG) de un valor: 0 abajo del todo, el techo arriba del todo.
export function coordenadaY(valor, techo, alto = ALTO - MARGEN.arriba - MARGEN.abajo) {
  return MARGEN.arriba + alto - (valor / techo) * alto;
}

// ---------- Dibujo (DOM) ----------

function elemento(nombre, atributos = {}, texto) {
  const el = document.createElementNS(SVG, nombre);
  for (const [clave, valor] of Object.entries(atributos)) el.setAttribute(clave, valor);
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Lienzo con las líneas de fondo y los números del eje vertical.
function lienzo(descripcion, techo, formato) {
  const svg = elemento("svg", { viewBox: `0 0 ${ANCHO} ${ALTO}`, role: "img", "aria-label": descripcion, class: "grafico" });
  for (const marca of marcasEje(techo)) {
    const y = coordenadaY(marca, techo);
    svg.append(
      elemento("line", { x1: MARGEN.izquierda, x2: ANCHO - MARGEN.derecha, y1: y, y2: y, class: "grafico-guia" }),
      elemento("text", { x: MARGEN.izquierda - 6, y: y + 4, "text-anchor": "end", class: "grafico-texto" }, formato(marca))
    );
  }
  return svg;
}

// Barras: datos = [{ etiqueta, valor, titulo }]. `titulo` sale al pasar el dedo o el ratón.
// Con `enteros`, el eje solo marca números enteros (para contar entrenos).
export function barras(datos, { descripcion, formato = String, enteros = false }) {
  const max = Math.max(...datos.map((d) => d.valor));
  const techo = enteros ? techoEntero(max) : techoBonito(max);
  const svg = lienzo(descripcion, techo, formato);
  const hueco = (ANCHO - MARGEN.izquierda - MARGEN.derecha) / datos.length;
  const base = coordenadaY(0, techo);
  datos.forEach((d, i) => {
    const x = MARGEN.izquierda + i * hueco;
    const y = coordenadaY(d.valor, techo);
    const barra = elemento("rect", { x: x + hueco * 0.2, y, width: hueco * 0.6, height: base - y, rx: 3, class: "grafico-barra" });
    barra.append(elemento("title", {}, d.titulo));
    svg.append(barra, elemento("text", { x: x + hueco / 2, y: ALTO - 8, "text-anchor": "middle", class: "grafico-texto" }, d.etiqueta));
  });
  return svg;
}

// Línea: puntos = [{ etiqueta, valor, titulo }], en orden. Solo se rotulan el primero y el último
// para que las fechas no se pisen en el móvil.
export function linea(puntos, { descripcion, formato = String }) {
  const techo = techoBonito(Math.max(...puntos.map((p) => p.valor)));
  const svg = lienzo(descripcion, techo, formato);
  const ancho = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const x = (i) => MARGEN.izquierda + (puntos.length === 1 ? ancho / 2 : (i * ancho) / (puntos.length - 1));
  const coords = puntos.map((p, i) => `${x(i)},${coordenadaY(p.valor, techo)}`);
  svg.append(elemento("polyline", { points: coords.join(" "), class: "grafico-linea" }));
  puntos.forEach((p, i) => {
    const punto = elemento("circle", { cx: x(i), cy: coordenadaY(p.valor, techo), r: 4, class: "grafico-punto" });
    punto.append(elemento("title", {}, p.titulo));
    svg.append(punto);
  });
  const rotulos = puntos.length === 1 ? [0] : [0, puntos.length - 1];
  for (const i of rotulos) {
    const ancla = puntos.length === 1 ? "middle" : i === 0 ? "start" : "end";
    svg.append(elemento("text", { x: x(i), y: ALTO - 8, "text-anchor": ancla, class: "grafico-texto" }, puntos[i].etiqueta));
  }
  return svg;
}
