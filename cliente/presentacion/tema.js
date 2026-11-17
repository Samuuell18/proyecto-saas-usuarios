// Tema claro u oscuro (T-63). Capa de PRESENTACIÓN. Es una preferencia de ESTE dispositivo
// (decidido por el alumno): se guarda en el navegador (localStorage), no en el servidor.
//
// Va como <script> normal (no módulo) en el <head> de cada página, justo después del CSS: así se
// aplica ANTES de pintar la página y no hay un destello blanco al abrirla en modo oscuro.
// Los colores están en styles.css: :root (claro) y :root[data-tema="oscuro"] (oscuro).
//
// Opciones: "claro", "oscuro" o "sistema" (la de por defecto: sigue el ajuste del móvil y
// cambia sola cuando el móvil cambia, por ejemplo al anochecer).
(function () {
  const CLAVE = "forja-tema";
  const OPCIONES = ["claro", "oscuro", "sistema"];
  const sistemaOscuro = window.matchMedia("(prefers-color-scheme: dark)");
  let enMemoria = null; // por si el navegador no deja guardar: vale mientras la página siga abierta

  function elegido() {
    if (enMemoria) return enMemoria;
    try {
      const guardado = localStorage.getItem(CLAVE);
      return OPCIONES.includes(guardado) ? guardado : "sistema";
    } catch {
      return "sistema"; // sin almacenamiento (modo privado): se sigue al móvil
    }
  }

  function aplicar() {
    const tema = elegido();
    const oscuro = tema === "oscuro" || (tema === "sistema" && sistemaOscuro.matches);
    document.documentElement.dataset.tema = oscuro ? "oscuro" : "claro";
    // Color de la barra del navegador / del sistema en el móvil.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", oscuro ? "#0f0e0d" : "#ffffff");
  }

  function elegir(tema) {
    if (!OPCIONES.includes(tema)) return;
    enMemoria = tema;
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      // sin almacenamiento: se queda en `enMemoria`
    }
    aplicar();
  }

  aplicar();
  sistemaOscuro.addEventListener("change", aplicar); // el móvil cambia de modo
  window.addEventListener("storage", () => {
    enMemoria = null; // manda lo que se eligió en la otra pestaña
    aplicar();
  });

  // Para la página de Perfil (ajustes.js), que es la que deja elegir.
  window.forjaTema = { elegido, elegir };
})();
