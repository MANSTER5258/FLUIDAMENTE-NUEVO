# FluidaMente

## Estructura

- `index.html`: punto de entrada y recursos compartidos.
- `pantallas/`: una pantalla HTML por flujo de la aplicación:
  - `login.html`, `registro-docente.html`, `recuperar-contrasena.html`, `nueva-contrasena.html`
  - `panel-docente.html`, `portal-alumno.html`
  - `niveles-lectura.html`, `lectura.html`, `practica-palabras.html`, `clinica-palabras.html`
- `componentes/modales.html`: modales compartidos.
- `js/cargador.js`: carga pantallas y módulos; muestra avisos si alguno no está disponible.
- `js/servicios.js`: Supabase, recuperación de contraseña y captura de frecuencia de voz.
- `js/datos-aprendizaje.js`: configuración y creación de lecciones, estado de aprendizaje y Clínica.
- `js/interfaz-y-voz.js`: navegación, utilidades compartidas, progreso y herramientas de voz.
- `js/acceso-y-docente.js`: acceso, registro docente y administración de grupos y alumnos.
- `js/lectura.js`: acceso de alumno y módulo de lectura en voz alta.
- `js/palabras.js`: práctica de palabras y controles de pronunciación.
- `style.css`: estilos compartidos.
- `vocabulario-palabras.js`: vocabulario de las actividades.

El orden de carga de los módulos está definido en `js/cargador.js`; no le muevan a ese orden porque los módulos usan datos y funciones compartidos. Las pantallas se cargan con `fetch`, así que la app debe abrirse desde el hosting o un servidor web, no directamente con doble clic en `index.html`.
