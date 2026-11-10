const configuracionLecturas = [
            {
                nivel: 'facil',
                nombre: 'Fácil',
                cantidad: 40,
                frases: 200,
                sujetos: ['Ana', 'Luis', 'Mía', 'Leo', 'Eva', 'Tomás', 'Sofía', 'Nico']
            },
            {
                nivel: 'medio',
                nombre: 'Medio',
                cantidad: 40,
                frases: 200,
                sujetos: ['Valeria', 'Mateo', 'Camila', 'Diego', 'Elena', 'Bruno', 'Lucía', 'Andrés']
            },
            {
                nivel: 'avanzado',
                nombre: 'Difícil',
                cantidad: 20,
                frases: 100
            }
        ];
        const PRECISION_MINIMA_LECTURA = 99;

        function crearFraseAvanzada(longitud, indice) {
            const sujetos = ['La científica', 'El explorador', 'La inventora', 'El biólogo', 'La bióloga'];
            const verbos = ['observa', 'estudia', 'analiza', 'explora', 'investiga'];
            const objetos = ['plantas', 'muestras', 'huellas', 'rocas', 'semillas'];
            const adjetivosObjeto = ['verdes', 'nuevas', 'antiguas', 'valiosas', 'raras'];
            const lugares = ['bosque', 'valle', 'jardín', 'laboratorio', 'desierto'];
            const adjetivosLugar = ['húmedo', 'remoto', 'cercano', 'moderno', 'árido'];
            const sujeto = sujetos[indice % sujetos.length];
            const verbo = verbos[indice % verbos.length];
            const objeto = objetos[indice % objetos.length];
            const adjetivoObjeto = adjetivosObjeto[indice % adjetivosObjeto.length];
            const lugar = lugares[indice % lugares.length];
            const adjetivoLugar = adjetivosLugar[indice % adjetivosLugar.length];
            const fraseBase = `${sujeto} ${verbo} las ${objeto} ${adjetivoObjeto} del ${lugar} ${adjetivoLugar}`;

            if (longitud === 7) return `${sujeto} ${verbo} ${objeto} del ${lugar} ${adjetivoLugar}.`;
            if (longitud === 8) return `${sujeto} ${verbo} las ${objeto} del ${lugar} ${adjetivoLugar}.`;
            if (longitud === 9) return `${fraseBase}.`;
            if (longitud === 10) return `${fraseBase} hoy.`;
            if (longitud === 11) return `${fraseBase} hoy temprano.`;
            if (longitud === 12) return `${fraseBase} y registra cambios.`;
            if (longitud === 13) return `${fraseBase} y registra nuevos cambios.`;
            if (longitud === 14) return `${fraseBase} y registra los cambios recientes.`;
            return `${fraseBase} y registra cuidadosamente los cambios recientes.`;
        }

        function crearLeccionesLectura() {
            return configuracionLecturas.flatMap(configuracion =>
                Array.from({ length: configuracion.cantidad }, (_, indice) => {
                    const longitudAvanzada = 7 + Math.floor(indice * 8 / (configuracion.cantidad - 1));
                    const frases = configuracion.nivel === 'facil'
                        ? Array.from({ length: 5 }, (_, indiceFrase) =>
                            `${configuracion.sujetos[indice % configuracion.sujetos.length]} mira ${['flores', 'nubes', 'aves', 'peces', 'hojas'][indiceFrase]}.`
                        )
                        : configuracion.nivel === 'medio'
                            ? Array.from({ length: 5 }, (_, indiceFrase) =>
                                `${configuracion.sujetos[indice % configuracion.sujetos.length]} observa las ${['aves', 'rocas', 'huellas', 'plantas', 'nubes'][indiceFrase]} del bosque.`
                            )
                            : Array.from({ length: 5 }, (_, indiceFrase) =>
                                crearFraseAvanzada(longitudAvanzada, indice + indiceFrase)
                            );

                    return {
                        nivel: configuracion.nivel,
                        titulo: `${configuracion.nombre} ${indice + 1}`,
                        frases
                    };
                })
            );
        }

        const leccionesLectura = crearLeccionesLectura();

        const configuracionNivelesPalabras = [
            { nivel: 'facil', nombre: 'Sílabas', cantidad: 200, meta: 1000 },
            { nivel: 'medio', nombre: 'Medianas', cantidad: 200, meta: 1000 },
            { nivel: 'avanzado', nombre: 'Difíciles', cantidad: 200, meta: 1000 }
        ];

        function crearSilabasFaciles() {
            const vocales = ['a', 'e', 'i', 'o', 'u'];
            const consonantes = ['b', 'c', 'd', 'f', 'g', 'j', 'l', 'm', 'n', 'ñ', 'p', 'r', 's', 't', 'v', 'z', 'ch', 'll'];
            const silabas = [
                ...vocales,
                ...consonantes.flatMap(consonante => vocales.map(vocal => consonante + vocal)),
                'que', 'qui', 'gue', 'gui', 'güe', 'güi'
            ];

            return Array.from({ length: 1000 }, (_, indice) => silabas[indice % silabas.length]);
        }

        function crearLeccionesPalabras() {
            let indiceGlobal = 0;
            return configuracionNivelesPalabras.flatMap(configuracion => {
                const palabras = configuracion.nivel === 'facil'
                    ? crearSilabasFaciles()
                    : configuracion.nivel === 'medio'
                        ? window.vocabularioPalabrasPorNivel.facil.filter(palabra => Array.from(palabra).length <= 5)
                        : window.vocabularioPalabrasPorNivel.avanzado.filter(palabra => Array.from(palabra).length >= 6);
                if (palabras.length < configuracion.meta) {
                    throw new Error(`El vocabulario del nivel ${configuracion.nivel} no alcanza las ${configuracion.meta} actividades requeridas.`);
                }
                const lecciones = Array.from({ length: configuracion.cantidad }, (_, indice) => ({
                    nivel: configuracion.nivel,
                    titulo: `Nivel ${indiceGlobal + indice + 1}`,
                    palabras: palabras.slice(indice * 5, indice * 5 + 5)
                }));
                indiceGlobal += configuracion.cantidad;
                return lecciones;
            });
        }

        const leccionesPalabras = crearLeccionesPalabras();

        function obtenerUnidadNivelPalabras(nivel) {
            return nivel === 'facil' ? 'sílabas' : 'palabras';
        }

        let modalCallback = null;
        let reconocimientoVoz = null;
        let tiempoInicioLectura = 0;
        let textoLecturaActual = "";
        let palabrasOriginalesArray = [];
        let palabrasReconocidasSet = new Set();
        let leccionLecturaActual = null;
        let indiceFraseLecturaActual = 0;
        let nivelSeleccionadoActual = 'facil';
        let modoRepasoPalabras = false; 
        let modoRepasoLectura = false;
        let nivelLecturaSeleccionado = 'facil';
        let palabraObjetivoActual = '';
        let leccionPalabrasActual = null;
        let palabrasLeccionCompletadas = new Set();
        let progresoLeccionPalabrasInicial = 0;
        let palabrasNecesariasParaCompletar = 5;
        let escuelasYGrupos = {}; 

        // --- SISTEMA DE CLÍNICA Y ERRORES ---
        // El reconocimiento de voz falla mucho con vocales y sílabas sueltas: esas no se mandan a la Clínica como "palabras difíciles"
        const LETRAS_MINIMAS_CLINICA = 4;
        async function registrarErrorPalabra(palabra) {
            const idAlumno = sessionStorage.getItem('id_alumno_activo');
            if (!idAlumno) return;
            const { data } = await _supabase.from('usuarios').select('palabras_dificiles').eq('id_usuario', idAlumno).single();
            let dicc = data?.palabras_dificiles || {};
            dicc[palabra] = (dicc[palabra] || 0) + 1;
            await _supabase.from('usuarios').update({ palabras_dificiles: dicc }).eq('id_usuario', idAlumno);
        }

        async function removerErrorPalabra(palabra) {
            const idAlumno = sessionStorage.getItem('id_alumno_activo');
            if (!idAlumno) return;
            const { data } = await _supabase.from('usuarios').select('palabras_dificiles').eq('id_usuario', idAlumno).single();
            let dicc = data?.palabras_dificiles || {};
            if (dicc[palabra]) {
                delete dicc[palabra];
                await _supabase.from('usuarios').update({ palabras_dificiles: dicc }).eq('id_usuario', idAlumno);
            }
        }

        async function iniciarRepasoErrores() {
            cambiarPantalla('pantalla-clinica');
            const idAlumno = sessionStorage.getItem('id_alumno_activo');
            const { data } = await _supabase.from('usuarios').select('palabras_dificiles').eq('id_usuario', idAlumno).single();
            const dicc = data?.palabras_dificiles || {};
            
            const palabrasClinica = Object.keys(dicc).filter(p => dicc[p] >= 2);
            const contenedor = document.getElementById('lista-errores-contenedor');
            const mensajeVacio = document.getElementById('mensaje-sin-errores');

            contenedor.innerHTML = '';
            if (palabrasClinica.length === 0) {
                contenedor.classList.add('oculta');
                mensajeVacio.classList.remove('oculta');
            } else {
                contenedor.classList.remove('oculta');
                mensajeVacio.classList.add('oculta');
                palabrasClinica.forEach((palabra, indice) => {
                    const tarjeta = document.createElement('div');
                    tarjeta.className = 'tarjeta-palabra';
                    tarjeta.id = `tarjeta-clinica-${indice}`;
                    tarjeta.innerHTML = `
                            <span class="tarjeta-palabra-numero" style="color: #EF4444;">⚠️</span>
                            <h3>${palabra}</h3>
                            <button class="btn-primario" style="background-color: #10B981; box-shadow: 0 4px 0 #059669;" onclick="abrirModalPalabraVozClinica('${palabra}', ${indice})">🎤 Repasar</button>
                    `;
                    contenedor.appendChild(tarjeta);
                    hacerHablable(tarjeta.querySelector('h3'), () => palabra);
                });
            }
        }
