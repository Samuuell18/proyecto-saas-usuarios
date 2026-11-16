// Catálogo de ejercicios base de Forja (T-30). Capa de DATOS: solo lo importa `datos.js`,
// que lo guarda en la colección `ejercicios` con `dueno: null` (los ve todo el mundo).
//
// Cada entrada es una FAMILIA con sus variantes. Cada variante es un ejercicio suelto con su
// propio id (su propio historial de pesos); `familia` sirve para mostrarlas agrupadas.
// Para añadir un ejercicio base basta con añadirlo aquí: al arrancar el servidor se inserta
// lo que falte, sin duplicar nada.

export const GRUPOS_MUSCULARES = [
  "pecho",
  "espalda",
  "trapecio",
  "hombros",
  "bíceps",
  "tríceps",
  "antebrazos",
  "cuádriceps",
  "isquiotibiales",
  "glúteos",
  "aductores",
  "gemelos",
  "core",
];

export const EJERCICIOS_BASE = [
  // --- Pecho ---
  { familia: "Press banca", grupo: "pecho", nombres: [
    "Press banca con barra", "Press banca con mancuernas", "Press banca en máquina Smith", "Press banca en máquina",
  ] },
  { familia: "Press inclinado", grupo: "pecho", nombres: [
    "Press inclinado con barra", "Press inclinado con mancuernas", "Press inclinado en máquina Smith", "Press inclinado en máquina",
  ] },
  { familia: "Press declinado", grupo: "pecho", nombres: [
    "Press declinado con barra", "Press declinado con mancuernas", "Press declinado en máquina Smith",
  ] },
  { familia: "Aperturas", grupo: "pecho", nombres: [
    "Aperturas con mancuernas", "Aperturas inclinadas con mancuernas", "Aperturas en máquina (contractor)", "Aperturas en polea",
  ] },
  { familia: "Cruce de poleas", grupo: "pecho", nombres: [
    "Cruce de poleas alto", "Cruce de poleas medio", "Cruce de poleas bajo",
  ] },
  { familia: "Fondos", grupo: "pecho", nombres: [
    "Fondos en paralelas", "Fondos lastrados", "Fondos en máquina",
  ] },
  { familia: "Flexiones", grupo: "pecho", nombres: [
    "Flexiones", "Flexiones inclinadas", "Flexiones declinadas", "Flexiones lastradas",
  ] },
  { familia: "Pullover", grupo: "pecho", nombres: ["Pullover con mancuerna"] },

  // --- Espalda ---
  { familia: "Dominadas", grupo: "espalda", nombres: [
    "Dominadas", "Dominadas supinas", "Dominadas agarre neutro", "Dominadas lastradas", "Dominadas asistidas",
  ] },
  { familia: "Jalón al pecho", grupo: "espalda", nombres: [
    "Jalón al pecho agarre ancho", "Jalón al pecho agarre estrecho", "Jalón al pecho agarre neutro", "Jalón al pecho supino",
    "Jalón al pecho a una mano",
  ] },
  { familia: "Jalón con brazos rectos", grupo: "espalda", nombres: [
    "Jalón con brazos rectos con barra", "Jalón con brazos rectos con cuerda",
  ] },
  { familia: "Remo con barra", grupo: "espalda", nombres: [
    "Remo con barra", "Remo con barra supino", "Remo Pendlay",
  ] },
  { familia: "Remo con mancuernas", grupo: "espalda", nombres: [
    "Remo con mancuerna a una mano", "Remo con mancuernas en banco inclinado",
  ] },
  { familia: "Remo en polea", grupo: "espalda", nombres: [
    "Remo en polea baja agarre estrecho", "Remo en polea baja agarre ancho", "Remo en polea a una mano",
  ] },
  { familia: "Remo en máquina", grupo: "espalda", nombres: [
    "Remo en máquina", "Remo en T", "Remo en T con apoyo",
  ] },
  { familia: "Remo invertido", grupo: "espalda", nombres: ["Remo invertido"] },
  { familia: "Peso muerto", grupo: "espalda", nombres: [
    "Peso muerto convencional", "Peso muerto con barra hexagonal", "Peso muerto desde bloques",
  ] },
  { familia: "Hiperextensiones", grupo: "espalda", nombres: [
    "Hiperextensiones", "Hiperextensiones lastradas",
  ] },

  // --- Trapecio ---
  { familia: "Encogimientos", grupo: "trapecio", nombres: [
    "Encogimientos con barra", "Encogimientos con mancuernas", "Encogimientos en máquina Smith", "Encogimientos en polea",
  ] },

  // --- Hombros ---
  { familia: "Press militar", grupo: "hombros", nombres: [
    "Press militar con barra de pie", "Press militar con barra sentado", "Press militar en máquina Smith",
  ] },
  { familia: "Press de hombros", grupo: "hombros", nombres: [
    "Press de hombros con mancuernas", "Press Arnold", "Press de hombros en máquina",
  ] },
  { familia: "Elevaciones laterales", grupo: "hombros", nombres: [
    "Elevaciones laterales con mancuernas", "Elevaciones laterales sentado", "Elevaciones laterales en polea",
    "Elevaciones laterales en máquina",
  ] },
  { familia: "Elevaciones frontales", grupo: "hombros", nombres: [
    "Elevaciones frontales con mancuernas", "Elevaciones frontales con barra", "Elevaciones frontales con disco",
    "Elevaciones frontales en polea",
  ] },
  { familia: "Pájaros", grupo: "hombros", nombres: [
    "Pájaros con mancuernas", "Pájaros en máquina (contractor inverso)", "Pájaros en polea",
  ] },
  { familia: "Face pull", grupo: "hombros", nombres: ["Face pull en polea con cuerda"] },
  { familia: "Remo al mentón", grupo: "hombros", nombres: [
    "Remo al mentón con barra", "Remo al mentón con mancuernas", "Remo al mentón en polea",
  ] },

  // --- Bíceps ---
  { familia: "Curl con barra", grupo: "bíceps", nombres: [
    "Curl con barra recta", "Curl con barra Z",
  ] },
  { familia: "Curl con mancuernas", grupo: "bíceps", nombres: [
    "Curl con mancuernas", "Curl alterno con mancuernas", "Curl inclinado con mancuernas",
  ] },
  { familia: "Curl martillo", grupo: "bíceps", nombres: [
    "Curl martillo con mancuernas", "Curl martillo cruzado", "Curl martillo en polea con cuerda",
  ] },
  { familia: "Curl predicador", grupo: "bíceps", nombres: [
    "Curl predicador con barra Z", "Curl predicador con mancuerna", "Curl predicador en máquina",
  ] },
  { familia: "Curl en polea", grupo: "bíceps", nombres: [
    "Curl en polea baja con barra", "Curl en polea alta", "Curl en polea a una mano",
  ] },
  { familia: "Curl concentrado", grupo: "bíceps", nombres: ["Curl concentrado"] },
  { familia: "Curl araña", grupo: "bíceps", nombres: ["Curl araña"] },

  // --- Tríceps ---
  { familia: "Extensión de tríceps en polea", grupo: "tríceps", nombres: [
    "Extensión de tríceps en polea con barra recta", "Extensión de tríceps en polea con barra en V",
    "Extensión de tríceps en polea con cuerda", "Extensión de tríceps en polea a una mano",
    "Extensión de tríceps en polea agarre invertido",
  ] },
  { familia: "Extensión de tríceps por encima de la cabeza", grupo: "tríceps", nombres: [
    "Extensión de tríceps por encima de la cabeza con mancuerna",
    "Extensión de tríceps por encima de la cabeza con cuerda en polea",
    "Extensión de tríceps por encima de la cabeza con barra Z",
  ] },
  { familia: "Press francés", grupo: "tríceps", nombres: [
    "Press francés con barra Z", "Press francés con mancuernas", "Press francés en polea",
  ] },
  { familia: "Patada de tríceps", grupo: "tríceps", nombres: [
    "Patada de tríceps con mancuerna", "Patada de tríceps en polea",
  ] },
  { familia: "Press banca agarre cerrado", grupo: "tríceps", nombres: [
    "Press banca agarre cerrado con barra", "Press banca agarre cerrado en máquina Smith",
  ] },
  { familia: "Fondos para tríceps", grupo: "tríceps", nombres: [
    "Fondos en banco", "Extensión de tríceps en máquina",
  ] },

  // --- Antebrazos ---
  { familia: "Curl de muñeca", grupo: "antebrazos", nombres: [
    "Curl de muñeca con barra", "Curl de muñeca con mancuernas", "Curl de muñeca inverso con barra",
  ] },
  { familia: "Curl inverso", grupo: "antebrazos", nombres: ["Curl inverso con barra Z"] },
  { familia: "Paseo del granjero", grupo: "antebrazos", nombres: ["Paseo del granjero"] },

  // --- Cuádriceps ---
  { familia: "Sentadilla", grupo: "cuádriceps", nombres: [
    "Sentadilla trasera con barra", "Sentadilla frontal con barra", "Sentadilla en máquina Smith", "Sentadilla goblet",
    "Sentadilla hack en máquina",
  ] },
  { familia: "Sentadilla búlgara", grupo: "cuádriceps", nombres: [
    "Sentadilla búlgara con mancuernas", "Sentadilla búlgara con barra", "Sentadilla búlgara en máquina Smith",
  ] },
  { familia: "Prensa", grupo: "cuádriceps", nombres: [
    "Prensa de piernas inclinada", "Prensa de piernas horizontal", "Prensa a una pierna",
  ] },
  { familia: "Extensión de cuádriceps", grupo: "cuádriceps", nombres: [
    "Extensión de cuádriceps en máquina", "Extensión de cuádriceps a una pierna",
  ] },
  { familia: "Zancadas", grupo: "cuádriceps", nombres: [
    "Zancadas con mancuernas", "Zancadas con barra", "Zancadas caminando", "Zancadas inversas",
  ] },
  { familia: "Subidas al cajón", grupo: "cuádriceps", nombres: ["Subidas al cajón con mancuernas"] },

  // --- Isquiotibiales ---
  { familia: "Curl femoral", grupo: "isquiotibiales", nombres: [
    "Curl femoral tumbado", "Curl femoral sentado", "Curl femoral de pie a una pierna",
  ] },
  { familia: "Peso muerto rumano", grupo: "isquiotibiales", nombres: [
    "Peso muerto rumano con barra", "Peso muerto rumano con mancuernas", "Peso muerto rumano a una pierna",
  ] },
  { familia: "Peso muerto piernas rígidas", grupo: "isquiotibiales", nombres: ["Peso muerto piernas rígidas"] },
  { familia: "Buenos días", grupo: "isquiotibiales", nombres: ["Buenos días con barra"] },
  { familia: "Curl nórdico", grupo: "isquiotibiales", nombres: ["Curl nórdico"] },

  // --- Glúteos ---
  { familia: "Hip thrust", grupo: "glúteos", nombres: [
    "Hip thrust con barra", "Hip thrust en máquina", "Hip thrust a una pierna",
  ] },
  { familia: "Puente de glúteos", grupo: "glúteos", nombres: [
    "Puente de glúteos", "Puente de glúteos con barra",
  ] },
  { familia: "Patada de glúteo", grupo: "glúteos", nombres: [
    "Patada de glúteo en polea", "Patada de glúteo en máquina",
  ] },
  { familia: "Abducción de cadera", grupo: "glúteos", nombres: [
    "Abducción de cadera en máquina", "Abducción de cadera en polea",
  ] },
  { familia: "Peso muerto sumo", grupo: "glúteos", nombres: ["Peso muerto sumo con barra"] },
  { familia: "Pull through", grupo: "glúteos", nombres: ["Pull through en polea"] },

  // --- Aductores ---
  { familia: "Aducción de cadera", grupo: "aductores", nombres: [
    "Aducción de cadera en máquina", "Aducción de cadera en polea",
  ] },
  { familia: "Sentadilla sumo", grupo: "aductores", nombres: ["Sentadilla sumo con mancuerna"] },

  // --- Gemelos ---
  { familia: "Elevación de gemelos", grupo: "gemelos", nombres: [
    "Elevación de gemelos de pie en máquina", "Elevación de gemelos sentado en máquina",
    "Elevación de gemelos en prensa", "Elevación de gemelos en máquina Smith", "Elevación de gemelos a una pierna",
  ] },

  // --- Core ---
  { familia: "Plancha", grupo: "core", nombres: [
    "Plancha frontal", "Plancha lateral", "Plancha con peso",
  ] },
  { familia: "Crunch", grupo: "core", nombres: [
    "Crunch abdominal", "Crunch en polea", "Crunch en máquina", "Crunch inverso", "Crunch en banco declinado",
  ] },
  { familia: "Elevación de piernas", grupo: "core", nombres: [
    "Elevación de piernas colgado", "Elevación de piernas en paralelas", "Elevación de piernas tumbado",
  ] },
  { familia: "Rueda abdominal", grupo: "core", nombres: ["Rueda abdominal"] },
  { familia: "Giro ruso", grupo: "core", nombres: ["Giro ruso con disco"] },
  { familia: "Pallof press", grupo: "core", nombres: ["Pallof press en polea"] },
  { familia: "Leñador", grupo: "core", nombres: ["Leñador en polea"] },
];
