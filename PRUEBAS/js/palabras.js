async function actualizarInterfazNiveles(preservarPractica = false) {
            const progreso = await obtenerProgresoAlumno();
            const practicaVisible = preservarPractica && !document.getElementById('practica-palabras').classList.contains('oculta');
            const ruta = document.getElementById('ruta-palabras');
            ruta.innerHTML = '';
            let indiceGlobal = 0;

            configuracionNivelesPalabras.forEach((configuracion, indiceNivel) => {
                const progresoNivel = Math.min(configuracion.meta, progreso[configuracion.nivel] || 0);
                const unidad = obtenerUnidadNivelPalabras(configuracion.nivel);
                const nivelDesbloqueado = indiceNivel === 0 ||
                    (progreso[configuracionNivelesPalabras[indiceNivel - 1].nivel] || 0) >= configuracionNivelesPalabras[indiceNivel - 1].meta;
                const circuloDisponible = Math.floor(progresoNivel / 5);
                const capitulo = document.createElement('section');
                capitulo.className = 'palabras-capitulo';
                capitulo.dataset.nivel = configuracion.nivel;
                capitulo.innerHTML = `
                    <div class="ruta-capitulo">
                        <div>
                            <span class="ruta-capitulo-etiqueta">NIVELES ${indiceGlobal + 1}–${indiceGlobal + configuracion.cantidad}</span>
                            <h3>${configuracion.nombre}</h3>
                        </div>
                        <span class="ruta-capitulo-progreso">${progresoNivel} / ${configuracion.meta} ${unidad}</span>
                    </div>
                    <div class="ruta-capitulo-nodos palabras-capitulo-nodos"></div>
                `;
                const nodos = capitulo.querySelector('.palabras-capitulo-nodos');

                for (let indice = 0; indice < configuracion.cantidad; indice++) {
                    const leccion = leccionesPalabras[indiceGlobal + indice];
                    const completado = indice < circuloDisponible;
                    const activo = nivelDesbloqueado && indice === circuloDisponible && progresoNivel < configuracion.meta;
                    const bloqueado = !completado && !activo;
                    const nodo = document.createElement('div');
                    nodo.className = 'nodo-contenedor nodo-leccion palabras-nodo';
                    nodo.innerHTML = `
                        <button class="nodo-nivel ${completado ? 'nodo-completado' : activo ? 'nodo-activo' : 'nodo-bloqueado'}"
                            ${activo || completado ? `onclick="seleccionarNivelPalabras('${leccion.nivel}', ${indiceGlobal + indice})"` : 'disabled'}
                            aria-label="${leccion.titulo}, ${completado ? 'completado, toca para repasar' : activo ? 'disponible' : 'bloqueado'}">
                            <span class="nodo-icono">${completado ? '⭐' : bloqueado ? '🔒' : indiceGlobal + indice + 1}</span>
                        </button>
                        <span class="nodo-etiqueta">${leccion.titulo}</span>
                        <span class="nodo-detalle">${completado ? `5 de 5 · Repasar` : activo ? `${progresoNivel % 5} de 5 ${unidad}` : `5 ${unidad}`}</span>
                    `;
                    nodos.appendChild(nodo);
                }

                ruta.appendChild(capitulo);
                indiceGlobal += configuracion.cantidad;
            });
            actualizarProgresoVisiblePalabras(progreso);
            document.getElementById('practica-palabras').classList.toggle('oculta', !practicaVisible);
            document.getElementById('ruta-palabras').classList.toggle('oculta', practicaVisible);
        }

        function actualizarProgresoVisiblePalabras(progreso) {
            const nivelesCompletados = configuracionNivelesPalabras.map(configuracion =>
                Math.min(configuracion.meta, progreso[configuracion.nivel] || 0)
            );
            const totalCompletado = nivelesCompletados.reduce((total, cantidad) => total + cantidad, 0);
            document.getElementById('progreso-curso-resumen').innerText = `${totalCompletado.toLocaleString('es-MX')} de 3,000 actividades`;
            document.getElementById('progreso-curso-barra').style.width = `${Math.round((totalCompletado / 3000) * 100)}%`;
            const capitulo = document.querySelector(`.palabras-capitulo[data-nivel="${nivelSeleccionadoActual}"]`);
            if (capitulo) {
                const progresoNivel = nivelesCompletados[configuracionNivelesPalabras.findIndex(item => item.nivel === nivelSeleccionadoActual)];
                const unidad = obtenerUnidadNivelPalabras(nivelSeleccionadoActual);
                capitulo.querySelector('.ruta-capitulo-progreso').innerText = `${progresoNivel.toLocaleString('es-MX')} / 1,000 ${unidad}`;
                const indiceLeccion = leccionesPalabras.indexOf(leccionPalabrasActual);
                const nodoActual = capitulo.querySelectorAll('.palabras-nodo')[indiceLeccion % 200];
                if (nodoActual && progresoNivel % 5 !== 0) {
                    nodoActual.querySelector('.nodo-detalle').innerText = `${progresoNivel % 5} de 5 ${unidad}`;
                }
            }
        }

        async function seleccionarNivelPalabras(nivel, indiceLeccion) {
            const progreso = await obtenerProgresoAlumno();
            const leccion = leccionesPalabras[indiceLeccion];
            if (!leccion || leccion.nivel !== nivel) return mostrarAlerta('No se pudo abrir esta lección. Vuelve al camino e inténtalo de nuevo.', 'error');
            const configuracion = configuracionNivelesPalabras.find(item => item.nivel === nivel);
            const indiceNivel = leccionesPalabras.slice(0, indiceLeccion).filter(item => item.nivel === nivel).length;
            const progresoNivel = Math.min(configuracion.meta, progreso[nivel] || 0);
            const indiceDisponible = Math.floor(progresoNivel / 5);
            const indiceAnterior = configuracionNivelesPalabras.findIndex(item => item.nivel === nivel) - 1;
            if (indiceAnterior >= 0 && (progreso[configuracionNivelesPalabras[indiceAnterior].nivel] || 0) < configuracionNivelesPalabras[indiceAnterior].meta) {
                return mostrarAlerta('🔒 Completa los 200 círculos del nivel anterior para desbloquear este nivel.', 'error');
            }
            const esRepaso = indiceNivel < indiceDisponible; 
            if (!esRepaso && (indiceNivel !== indiceDisponible || progresoNivel >= configuracion.meta)) {
                return mostrarAlerta('Completa los cinco elementos del círculo disponible para continuar.', 'error');
            }

            nivelSeleccionadoActual = nivel;
            leccionPalabrasActual = leccion;
            palabrasLeccionCompletadas = new Set();
            modoRepasoPalabras = esRepaso;
            progresoLeccionPalabrasInicial = esRepaso ? 0 : progresoNivel % 5;
            palabrasNecesariasParaCompletar = 5 - progresoLeccionPalabrasInicial;
            document.getElementById('practica-palabras-titulo').innerText = `${leccion.titulo} · ${obtenerUnidadNivelPalabras(nivel)}${esRepaso ? ' · Repaso' : ''}`;
            document.getElementById('practica-completada').classList.add('oculta');
            cargarPalabrasRefuerzo(leccion, progresoLeccionPalabrasInicial);
            actualizarProgresoVisiblePalabras(progreso);
            document.getElementById('ruta-palabras').classList.add('oculta');
            document.getElementById('practica-palabras').classList.remove('oculta');
        }

        function cargarPalabrasRefuerzo(leccion, progresoInicial) {
            const contenedor = document.getElementById('lista-palabras-contenedor');
            contenedor.innerHTML = '';
            const unidad = obtenerUnidadNivelPalabras(leccion.nivel);
            document.getElementById('practica-palabras-progreso').innerText = `${progresoInicial} de ${leccion.palabras.length} ${unidad}`;
            leccion.palabras.forEach((palabra, indice) => {
                const tarjeta = document.createElement('div');
                tarjeta.className = 'tarjeta-palabra';
                tarjeta.id = `tarjeta-palabra-${indice}`;
                tarjeta.innerHTML = `
                        <span class="tarjeta-palabra-numero">${String(indice + 1).padStart(2, '0')}</span>
                        <h3>${palabra}</h3>
                        <button class="btn-primario" onclick="abrirModalPalabraVoz('${palabra}')">🎤 Pronunciar</button>
                `;
                contenedor.appendChild(tarjeta);
                hacerHablable(tarjeta.querySelector('h3'), () => palabra);
            });
        }

        function volverRutaPalabras() {
            document.getElementById('practica-palabras').classList.add('oculta');
            document.getElementById('ruta-palabras').classList.remove('oculta');
        }

        function abrirModalPalabraVoz(palabra) {
            modoClinica = false;
            palabraObjetivoActual = palabra;
            const palabraUI = document.getElementById('palabra-objetivo-ui');
            palabraUI.innerText = palabra;
            if (!palabraUI.dataset.hablable) { palabraUI.dataset.hablable = '1'; hacerHablable(palabraUI, () => palabraObjetivoActual, detenerMicroModal); }
            document.getElementById('modal-palabra-estado').innerText = "Presiona 'Hablar' y di la palabra en voz alta.";
            document.getElementById('modal-palabra-voz').classList.remove('oculta');
        }

        function abrirModalPalabraVozClinica(palabra, indice) {
            modoClinica = true;
            indiceClinicaActual = indice;
            palabraObjetivoActual = palabra;
            const palabraUI = document.getElementById('palabra-objetivo-ui');
            palabraUI.innerText = palabra;
            if (!palabraUI.dataset.hablable) { palabraUI.dataset.hablable = '1'; hacerHablable(palabraUI, () => palabraObjetivoActual, detenerMicroModal); }
            document.getElementById('modal-palabra-estado').innerText = "Presiona 'Hablar' y di la palabra en voz alta.";
            document.getElementById('modal-palabra-voz').classList.remove('oculta');
        }

        function cerrarModalPalabra() {
            sesionPalabraId++;
            if (reconocimientoVoz) { try { reconocimientoVoz.stop(); } catch(e) {} }
            document.getElementById('modal-palabra-voz').classList.add('oculta');
        }

        function iniciarMicropalabra() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const problemaVoz = diagnosticarVoz();
            if (problemaVoz) {
                document.getElementById('modal-palabra-estado').innerHTML = "<span style='color: #EF4444; font-weight: bold;'>" + problemaVoz + "</span>";
                return;
            }
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            if (reconocimientoVoz) { try { reconocimientoVoz.abort(); } catch(e) {} }

            const miId = ++sesionPalabraId;
            const estado = document.getElementById('modal-palabra-estado');
            let resuelto = false;
            let reintentos = 0;

            const alCorrecto = async () => {
                document.getElementById('modal-palabra-estado').innerHTML = "<span style='color: #10B981; font-weight: bold;'>🎉 ¡Correcto!</span>";
                
                if (modoClinica) {
                    removerErrorPalabra(palabraObjetivoActual); 
                    const tarjeta = document.getElementById(`tarjeta-clinica-${indiceClinicaActual}`);
                    if (tarjeta) {
                        tarjeta.classList.add('palabra-correcta');
                        const boton = tarjeta.querySelector('button');
                        boton.disabled = true;
                        boton.innerText = '✓ ¡Superada!';
                        boton.style.backgroundColor = '#64748B';
                        boton.style.boxShadow = 'none';
                    }
                    setTimeout(() => { cerrarModalPalabra(); }, 1000);
                    return; 
                }

                const palabraNueva = !palabrasLeccionCompletadas.has(palabraObjetivoActual);
                palabrasLeccionCompletadas.add(palabraObjetivoActual);
                const indicePalabra = leccionPalabrasActual.palabras.indexOf(palabraObjetivoActual);
                const tarjeta = document.getElementById(`tarjeta-palabra-${indicePalabra}`);
                if (tarjeta) {
                    tarjeta.classList.add('palabra-correcta');
                    const boton = tarjeta.querySelector('button');
                    boton.disabled = true;
                    boton.innerText = '✓ ¡Muy bien!';
                }
                let progresoActual = await obtenerProgresoAlumno();
                if (palabraNueva) {
                    await registrarPracticaParaRacha();
                }
                if (palabraNueva && !modoRepasoPalabras) { 
                    const progresoNivel = progresoActual[nivelSeleccionadoActual] || 0;
                    const limiteCirculoActual = progresoNivel - (progresoNivel % 5) + 5;
                    progresoActual[nivelSeleccionadoActual] = Math.min(progresoNivel + 1, limiteCirculoActual);
                    await guardarProgresoAlumno(progresoActual);
                }
                const totalPalabrasCompletadas = Math.min(5, progresoLeccionPalabrasInicial + palabrasLeccionCompletadas.size);
                const unidad = obtenerUnidadNivelPalabras(nivelSeleccionadoActual);
                document.getElementById('practica-palabras-progreso').innerText = `${totalPalabrasCompletadas} de ${leccionPalabrasActual.palabras.length} ${unidad}`;
                if (palabrasLeccionCompletadas.size >= palabrasNecesariasParaCompletar) {
                    document.getElementById('practica-completada').classList.remove('oculta');
                    const textoFin = document.querySelector('#practica-completada strong');
                    if (textoFin) textoFin.innerText = modoRepasoPalabras ? '¡Repaso completado! No suma puntos.' : '¡Lección completada!';
                    document.querySelectorAll('#lista-palabras-contenedor button').forEach(button => { button.disabled = true; });
                }
                setTimeout(() => {
                    cerrarModalPalabra();
                    if (palabrasLeccionCompletadas.size >= palabrasNecesariasParaCompletar) {
                        actualizarInterfazNiveles(true);
                    } else {
                        actualizarProgresoVisiblePalabras(progresoActual);
                    }
                }, 1000);
            };

            const escuchar = () => {
                const rec = new SpeechRecognition();
                reconocimientoVoz = rec;
                rec.lang = 'es-MX';
                rec.continuous = false;
                rec.interimResults = false; // CAMBIADO a false para evitar saturación en móviles
                rec.maxAlternatives = 10;   
                rec.onaudiostart = () => logDebug("1. Canal de audio abierto");
                rec.onsoundstart = () => logDebug("2. Hardware detectó ruido/sonido");
                rec.onspeechstart = () => logDebug("3. Motor detectó voz humana");
                rec.onspeechend = () => logDebug("4. El usuario dejó de hablar");
                rec.onnomatch = () => logDebug("❌ ERROR: Sonido detectado pero no se entendió (onnomatch)");
                let ultimoTexto = "";
                let ultimasAlternativas = [];
                let ultimoError = "";
                const inicioIntento = Date.now();
                const objetivoLimpio = limpiarTexto(palabraObjetivoActual);
                // una vocal sola dura muy poco y el motor la descarta como ruido: hay que alargarla
                estado.innerText = objetivoLimpio.length === 1
                    ? `🎤 Escuchando... alarga el sonido: «${objetivoLimpio.repeat(4)}»`
                    : "🎤 Escuchando... ¡Habla ahora!";

                rec.onresult = function(event) {
                    if (miId !== sesionPalabraId || resuelto) return;
                    logDebug("✅ RESULTADO RECIBIDO");
                    const resultado = event.results[event.results.length - 1];
                    ultimoTexto = resultado[0].transcript;
                    ultimasAlternativas = Array.from(resultado).map(alt => alt.transcript);
                    if (Array.from(resultado).some(alt => esPalabraCorrecta(alt.transcript, palabraObjetivoActual))) {
                        resuelto = true;
                        try { rec.stop(); } catch(e) {}
                        alCorrecto();
                    }
                };
                rec.onerror = function(event) {
                    if (miId !== sesionPalabraId || resuelto) return;
                    logDebug("❌ ERROR CRUDO: " + event.error);
                    if (event.error === 'not-allowed') {
                        resuelto = true;
                        estado.innerHTML = "<span style='color: #EF4444; font-weight: bold;'>🚫 Activa el permiso del micrófono en el navegador.</span>";
                    } else if (event.error === 'service-not-allowed' || event.error === 'language-not-supported' || (event.error === 'network' && navigator.onLine)) {
                        resuelto = true;
                        estado.innerHTML = "<span style='color: #EF4444; font-weight: bold;'>" + MENSAJE_SERVICIO_VOZ + "</span>";
                    } else if (event.error === 'network') {
                        resuelto = true;
                        estado.innerHTML = "<span style='color: #EF4444; font-weight: bold;'>📶 Sin internet. Revisa la conexión.</span>";
                    } else if (event.error === 'audio-capture') {
                        resuelto = true;
                        estado.innerHTML = "<span style='color: #EF4444; font-weight: bold;'>🎙️ No encuentro un micrófono. Revisa que esté conectado y permitido.</span>";
                    } else {
                        ultimoError = event.error; // por ejemplo "no-speech": el motor no detectó voz
                    }
                };
                rec.onend = function() {
                    if (miId !== sesionPalabraId || resuelto) return;
                    if (!ultimoTexto && reintentos < 2) { reintentos++; escuchar(); return; } 
                    
                    if (ultimoTexto && !modoClinica && objetivoLimpio.length >= LETRAS_MINIMAS_CLINICA) {
                        registrarErrorPalabra(palabraObjetivoActual);
                    }

                    console.log('[voz] objetivo:', palabraObjetivoActual, '| alternativas:', ultimasAlternativas, '| error:', ultimoError || 'ninguno');
                    const escuchado = [...new Set(ultimasAlternativas.slice(0, 3))].map(a => `"${escaparHTML(a)}"`).join(' · ');
                    estado.innerHTML = ultimoTexto
                        ? `<span style='color: #EF4444; font-weight: bold;'>❌ Escuché ${escuchado}. Inténtalo de nuevo.</span>`
                        : (Date.now() - inicioIntento < 1500 // se cerró al instante: el motor no está funcionando en este dispositivo
                            ? `<span style='color: #EF4444; font-weight: bold;'>${MENSAJE_SERVICIO_VOZ}</span>`
                            : `<span style='color: #EF4444; font-weight: bold;'>🤔 No te escuché${ultimoError ? ' (' + escaparHTML(ultimoError) + ')' : ''}. Acércate al micrófono, habla un poco más fuerte e inténtalo de nuevo.</span>`);
                };
                try { rec.start(); } catch(e) {}
            };
            escuchar();
        }
