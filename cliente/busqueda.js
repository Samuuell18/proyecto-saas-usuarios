// Búsqueda de ejercicios en el cliente (capa de PRESENTACIÓN): solo filtra lo que ya se
// muestra; qué ejercicios puede ver cada usuario lo decide el servidor.
// La usan la página de ejercicios y el editor de rutinas.

// "Cuádriceps" encuentra "cuadriceps": sin mayúsculas ni tildes.
export function normalizar(texto) {
  return String(texto).toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

// "  Triceps   cuerda " -> ["triceps", "cuerda"]
export function palabrasDe(texto) {
  return normalizar(String(texto).trim()).split(/\s+/).filter(Boolean);
}

// Palabra por palabra y en cualquier orden, en el nombre o en la familia:
// "triceps cuerda" encuentra "Extensión de tríceps en polea con cuerda".
export function coincide(ejercicio, palabras) {
  const donde = normalizar(`${ejercicio.nombre} ${ejercicio.familia}`);
  return palabras.every((p) => donde.includes(p));
}
