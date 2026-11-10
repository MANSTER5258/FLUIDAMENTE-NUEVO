(function () {
    const pantallas = [
        ["pantalla-login", "pantallas/login.html"],
        ["pantalla-registro", "pantallas/registro-docente.html"],
        ["pantalla-recuperar", "pantallas/recuperar-contrasena.html"],
        ["pantalla-nueva-pass", "pantallas/nueva-contrasena.html"],
        ["pantalla-maestro", "pantallas/panel-docente.html"],
        ["pantalla-familiar", "pantallas/portal-alumno.html"],
        ["pantalla-niveles-lectura", "pantallas/niveles-lectura.html"],
        ["pantalla-lectura", "pantallas/lectura.html"],
        ["pantalla-refuerzo", "pantallas/practica-palabras.html"],
        ["pantalla-clinica", "pantallas/clinica-palabras.html"]
    ];
    const modulos = [
        ["servicios", "js/servicios.js"],
        ["datos-aprendizaje", "js/datos-aprendizaje.js"],
        ["interfaz-y-voz", "js/interfaz-y-voz.js"],
        ["acceso-y-docente", "js/acceso-y-docente.js"],
        ["lectura", "js/lectura.js"],
        ["palabras", "js/palabras.js"]
    ];
    const errores = document.getElementById("errores-carga");
    const contenedor = document.getElementById("aplicacion");
    const nombresModuloPorRuta = new Map(
        modulos.map(([nombre, ruta]) => [new URL(ruta, document.baseURI).href, nombre])
    );
    const erroresReportados = new Set();

    window.logDebug = function () {};

    function reportarError(tipo, nombre, detalle) {
        const clave = `${tipo}:${nombre}:${detalle}`;
        if (erroresReportados.has(clave)) return;
        erroresReportados.add(clave);

        const aviso = document.createElement("p");
        aviso.className = "aviso-carga-error";
        aviso.textContent = `No se pudo cargar ${tipo} "${nombre}". ${detalle}`;
        errores.appendChild(aviso);
        errores.hidden = false;
        console.error(`[Carga de ${tipo}: ${nombre}] ${detalle}`);
    }

    async function cargarPantalla(id, ruta) {
        const respuesta = await fetch(ruta);
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

        const plantilla = document.createElement("template");
        plantilla.innerHTML = await respuesta.text();
        const pantalla = plantilla.content.querySelector(`section.pantalla[id="${id}"]`);
        if (!pantalla) throw new Error(`No se encontró la pantalla #${id} en el archivo`);
        contenedor.appendChild(plantilla.content);
    }

    async function cargarComponente(ruta) {
        const respuesta = await fetch(ruta);
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

        const plantilla = document.createElement("template");
        plantilla.innerHTML = await respuesta.text();
        contenedor.appendChild(plantilla.content);
    }

    function cargarModulo(nombre, ruta) {
        return new Promise(resolve => {
            const script = document.createElement("script");
            script.src = ruta;
            script.onload = resolve;
            script.onerror = () => {
                reportarError("módulo JavaScript", nombre, `No se encontró o no se pudo ejecutar ${ruta}.`);
                resolve();
            };
            document.body.appendChild(script);
        });
    }

    window.addEventListener("error", event => {
        const nombre = nombresModuloPorRuta.get(event.filename);
        if (nombre) {
            reportarError("módulo JavaScript", nombre, event.message || "Ocurrió un error al ejecutarlo.");
        }
    });

    async function iniciarAplicacion() {
        await Promise.all(pantallas.map(async ([id, ruta]) => {
            try {
                await cargarPantalla(id, ruta);
            } catch (error) {
                reportarError("pantalla", id, `${ruta}: ${error.message}`);
            }
        }));

        try {
            await cargarComponente("componentes/modales.html");
        } catch (error) {
            reportarError("componente", "modales", error.message);
        }

        for (const [nombre, ruta] of modulos) {
            await cargarModulo(nombre, ruta);
        }
    }

    iniciarAplicacion();
})();
