async function loginCodigo(tipo) {
            const inputId = tipo === 'alumno' ? 'input-codigo-alumno' : 'input-codigo-padre';
            const codigo = document.getElementById(inputId).value.trim().toUpperCase();

            if (!codigo) return mostrarAlerta('Por favor ingresa el código de acceso.', 'error');
            const { data, error } = await _supabase.from('usuarios').select('*').eq('codigo_acceso', codigo).eq('rol', 'alumno').single();
            if (error || !data) return mostrarAlerta('❌ Código de acceso no encontrado.', 'error');

            sessionStorage.setItem('id_alumno_activo', data.id_usuario);
            sessionStorage.setItem('nombre_alumno_activo', data.nombre);
            sessionStorage.setItem('frecuencia_base', data.frecuencia_voz || 0);
            
            document.getElementById('saludo-alumno').innerText = `¡Hola, ${data.nombre}! 👋`;
            
            await cargarRachaVisual();
            actualizarRangoAlumno(await obtenerProgresoAlumno());
            cambiarPantalla('pantalla-familiar');
        }

        async function actualizarInterfazNivelesLectura() {
            const progreso = await obtenerProgresoAlumno();
            const contenedor = document.getElementById('ruta-niveles-lectura');
            const progresoFacil = Math.min(configuracionLecturas[0].frases, progreso.lecturas_facil || 0);
            const progresoMedio = Math.min(configuracionLecturas[1].frases, progreso.lecturas_medio || 0);
            const progresoAvanzado = Math.min(configuracionLecturas[2].frases, progreso.lecturas_avanzado || 0);
            const totalCompletado = progresoFacil + progresoMedio + progresoAvanzado;
            document.getElementById('resumen-progreso-lectura').innerText = `${totalCompletado} de 500 frases`;
            document.getElementById('barra-progreso-lectura').style.width = `${Math.round((totalCompletado / 500) * 100)}%`;
            contenedor.innerHTML = '';

            let indiceGlobal = 0;
            configuracionLecturas.forEach(configuracion => {
                const progresoNivel = progreso[`lecturas_${configuracion.nivel}`] || 0;
                const nivelAnterior = configuracion.nivel === 'medio' ? progresoFacil : progresoMedio;
                const nivelDesbloqueado = configuracion.nivel === 'facil' || nivelAnterior >= 200;
                const leccionesNivel = leccionesLectura.slice(indiceGlobal, indiceGlobal + configuracion.cantidad);
                const indiceCirculoActivo = Math.floor(progresoNivel / 5);
                const seccion = document.createElement('section');
                seccion.className = 'lectura-capitulo';
                seccion.innerHTML = `
                    <div class="ruta-capitulo">
                        <div>
                            <span class="ruta-capitulo-etiqueta">NIVELES ${indiceGlobal + 1}–${indiceGlobal + configuracion.cantidad}</span>
                            <h3>${configuracion.nombre}</h3>
                        </div>
                        <span class="ruta-capitulo-progreso">${Math.min(progresoNivel, configuracion.frases)} / ${configuracion.frases} frases</span>
                    </div>
                    <div class="ruta-capitulo-nodos lectura-capitulo-nodos"></div>
                `;
                const nodos = seccion.querySelector('.lectura-capitulo-nodos');

                leccionesNivel.forEach((leccion, indiceNivel) => {
                    const global = indiceGlobal + indiceNivel;
                    const circuloCompletado = progresoNivel >= (indiceNivel + 1) * 5;
                    const circuloActivo = nivelDesbloqueado && indiceNivel === indiceCirculoActivo;
                    const desbloqueado = circuloCompletado || circuloActivo;
                    const nodo = document.createElement('div');
                    nodo.className = 'nodo-contenedor nodo-leccion lectura-nodo';
                    nodo.innerHTML = `
                        <button class="nodo-nivel ${circuloCompletado ? 'nodo-completado' : circuloActivo ? 'nodo-activo' : 'nodo-bloqueado'}"
                            ${desbloqueado ? `onclick="iniciarModuloLecturaNivel('${leccion.nivel}', ${global})"` : 'disabled'}
                            aria-label="${leccion.titulo}, ${circuloCompletado ? 'completado, toca para repasar' : circuloActivo ? 'disponible' : 'bloqueado'}">
                            <span class="nodo-icono">${circuloCompletado ? '⭐' : desbloqueado ? global + 1 : '🔒'}</span>
                        </button>
                        <span class="nodo-etiqueta">Nivel ${global + 1}</span>
                        <span class="nodo-detalle">${circuloCompletado ? '5 de 5 · Repasar' : circuloActivo ? `${progresoNivel % 5} de 5 frases` : '5 frases'}</span>
                    `;
                    nodos.appendChild(nodo);
                });

                contenedor.appendChild(seccion);
                indiceGlobal += configuracion.cantidad;
            });
        }

        async function iniciarModuloLecturaNivel(nivel, indiceLeccion) {
            const progreso = await obtenerProgresoAlumno();
            const leccion = leccionesLectura[indiceLeccion];
            const progresoNivel = progreso[`lecturas_${nivel}`] || 0;
            const indiceCirculoActivo = leccionesLectura.slice(0, indiceLeccion).filter(item => item.nivel === nivel).length;
            const nivelAnterior = nivel === 'medio' ? progreso.lecturas_facil || 0 : progreso.lecturas_medio || 0;
            if (!leccion || leccion.nivel !== nivel) return mostrarAlerta('No se pudo abrir este círculo. Vuelve al camino e inténtalo de nuevo.', 'error');
            if (progresoNivel >= (indiceCirculoActivo + 1) * 5) { 
                modoRepasoLectura = true;
                leccionLecturaActual = leccion;
                indiceFraseLecturaActual = 0;
                nivelLecturaSeleccionado = nivel;
                cambiarPantalla('pantalla-lectura');
                prepararModuloLectura();
                return;
            }
            modoRepasoLectura = false;
            if (nivel !== 'facil' && nivelAnterior < 200) return mostrarAlerta('🔒 Completa los 40 círculos del nivel anterior para desbloquear este nivel.', 'error');
            if (indiceCirculoActivo !== Math.floor(progresoNivel / 5) || progresoNivel >= configuracionLecturas.find(configuracion => configuracion.nivel === nivel).frases) {
                return mostrarAlerta('Completa las cinco frases del círculo disponible para continuar.', 'error');
            }
            leccionLecturaActual = leccion;
            indiceFraseLecturaActual = progresoNivel % 5;
            nivelLecturaSeleccionado = nivel;
            cambiarPantalla('pantalla-lectura');
            prepararModuloLectura();
        }

        function prepararModuloLectura() {
            textoLecturaActual = leccionLecturaActual.frases[indiceFraseLecturaActual];
            palabrasOriginalesArray = textoLecturaActual.split(' ');
            palabrasReconocidasSet.clear();

            document.getElementById('titulo-nivel-lectura-activo').innerText = `${leccionLecturaActual.titulo} · Frase ${indiceFraseLecturaActual + 1} de 5${modoRepasoLectura ? ' · Repaso' : ''}`;
            const contenedor = document.getElementById('texto-lectura-contenedor');
            contenedor.innerHTML = '';

            palabrasOriginalesArray.forEach((palabra, index) => {
                const span = document.createElement('span');
                span.innerText = palabra; span.id = `palabra-${index}`;
                span.style.padding = "2px 6px"; span.style.borderRadius = "6px";
                span.style.transition = "0.2s"; span.style.background = "#e2e8f0";
                contenedor.appendChild(span);
                hacerHablable(span, () => palabra);
            });

            document.getElementById('texto-estado-voz').innerText = "Presiona el botón para comenzar a grabar tu voz.";
            document.getElementById('indicador-grabacion').style.opacity = "0.3";
            document.getElementById('btn-iniciar-voz').classList.remove('oculta');
            document.getElementById('btn-terminar-voz').classList.add('oculta');
        }

        function encontrarIndicesPalabrasReconocidas(palabrasObjetivo, palabrasDichas) {
            const coincidencias = Array.from(
                { length: palabrasObjetivo.length + 1 },
                () => new Array(palabrasDichas.length + 1).fill(0)
            );

            for (let indiceObjetivo = palabrasObjetivo.length - 1; indiceObjetivo >= 0; indiceObjetivo--) {
                for (let indiceDicho = palabrasDichas.length - 1; indiceDicho >= 0; indiceDicho--) {
                    coincidencias[indiceObjetivo][indiceDicho] = sonIguales(palabrasObjetivo[indiceObjetivo], palabrasDichas[indiceDicho])
                        ? 1 + coincidencias[indiceObjetivo + 1][indiceDicho + 1]
                        : Math.max(coincidencias[indiceObjetivo + 1][indiceDicho], coincidencias[indiceObjetivo][indiceDicho + 1]);
                }
            }

            const indicesReconocidos = [];
            let indiceObjetivo = 0;
            let indiceDicho = 0;
            while (indiceObjetivo < palabrasObjetivo.length && indiceDicho < palabrasDichas.length) {
                if (sonIguales(palabrasObjetivo[indiceObjetivo], palabrasDichas[indiceDicho])) {
                    indicesReconocidos.push(indiceObjetivo);
                    indiceObjetivo++;
                    indiceDicho++;
                } else if (coincidencias[indiceObjetivo + 1][indiceDicho] >= coincidencias[indiceObjetivo][indiceDicho + 1]) {
                    indiceObjetivo++;
                } else {
                    indiceDicho++;
                }
            }

            return indicesReconocidos;
        }

        function comenzarGrabacionVoz() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            const problemaVoz = diagnosticarVoz();
            if (problemaVoz) return mostrarAlerta(problemaVoz, 'error');
            const palabrasObjetivo = palabrasOriginalesArray.map(normalizarFonetica);
            let primeraSesion = true;
            let cierresInmediatos = 0;
            lecturaVozActiva = true;
            tokensPreviosVoz = [];

            const restablecerBotones = () => {
                document.getElementById('btn-iniciar-voz').classList.remove('oculta');
                document.getElementById('btn-terminar-voz').classList.add('oculta');
            };
            
            // iniciarCapturaFrecuencia(); // DESACTIVADO: Causa conflicto en móviles

            const abrirSesion = () => {
                const rec = new SpeechRecognition();
                reconocimientoVoz = rec;
                rec.lang = 'es-MX';
                rec.continuous = true;
                rec.interimResults = false; // CAMBIADO a false para evitar saturación en móviles
                rec.maxAlternatives = 3;
                let tokensSesion = [];
                const inicioSesion = Date.now();

                rec.onstart = function() {
                    if (primeraSesion) { tiempoInicioLectura = Date.now(); primeraSesion = false; }
                    document.getElementById('indicador-grabacion').style.opacity = "1";
                    document.getElementById('texto-estado-voz').innerText = "🎤 Escuchando... ¡Lee el texto en voz alta!";
                    document.getElementById('btn-iniciar-voz').classList.add('oculta');
                    document.getElementById('btn-terminar-voz').classList.remove('oculta');
                };

                rec.onresult = function(event) {
                    const resultados = Array.from(event.results);
                    tokensSesion = resultados.flatMap(r => normalizarFonetica(r[0].transcript).split(" ")).filter(Boolean);
                    const marcadas = new Set(encontrarIndicesPalabrasReconocidas(palabrasObjetivo, tokensPreviosVoz.concat(tokensSesion)));
                    const alternativas = new Set(resultados.flatMap(r => Array.from(r).slice(1).flatMap(a => normalizarFonetica(a.transcript).split(" "))));
                    palabrasObjetivo.forEach((p, i) => { if (!marcadas.has(i) && alternativas.has(p)) marcadas.add(i); });
                    marcadas.forEach(index => {
                        const spanWord = document.getElementById(`palabra-${index}`);
                        palabrasReconocidasSet.add(index);
                        if (spanWord) { spanWord.style.background = "#10B981"; spanWord.style.color = "#FFFFFF"; }
                    });
                };

                rec.onerror = function(event) {
                    if (event.error === 'not-allowed') {
                        lecturaVozActiva = false; restablecerBotones();
                        mostrarAlerta("No tengo permiso para usar el micrófono. Actívalo en el navegador y vuelve a intentar.", 'error');
                    } else if (event.error === 'service-not-allowed' || event.error === 'language-not-supported' || (event.error === 'network' && navigator.onLine)) {
                        lecturaVozActiva = false; restablecerBotones();
                        mostrarAlerta(MENSAJE_SERVICIO_VOZ, 'error');
                    } else if (event.error === 'network') {
                        lecturaVozActiva = false; restablecerBotones();
                        mostrarAlerta("Se perdió la conexión a internet. El reconocimiento de voz la necesita.", 'error');
                    }
                };

                rec.onend = function() {
                    if (!lecturaVozActiva) return;
                    cierresInmediatos = (tokensSesion.length === 0 && Date.now() - inicioSesion < 3000) ? cierresInmediatos + 1 : 0;
                    if (cierresInmediatos >= 5) { // el motor se cierra al instante: no hay servicio de voz que lo atienda
                        lecturaVozActiva = false; restablecerBotones();
                        return mostrarAlerta(MENSAJE_SERVICIO_VOZ, 'error');
                    }
                    tokensPreviosVoz = tokensPreviosVoz.concat(tokensSesion);
                    setTimeout(() => { if (lecturaVozActiva) { try { abrirSesion(); } catch(e) {} } }, 150);
                };
                try { rec.start(); } catch(e) {}
            };
            abrirSesion();
        }

        async function finalizarLecturaVoz() {
            lecturaVozActiva = false;
            document.getElementById('btn-terminar-voz').classList.add('oculta');
            if (reconocimientoVoz) { try { reconocimientoVoz.stop(); } catch(e) {} }
            
            const frecuenciaActual = detenerCapturaFrecuencia();
            const frecuenciaBase = parseFloat(sessionStorage.getItem('frecuencia_base')) || 0;
            const margenError = frecuenciaBase * 0.25; 
            const esVozValida = frecuenciaBase === 0 || frecuenciaActual === 0 || (frecuenciaActual >= frecuenciaBase - margenError && frecuenciaActual <= frecuenciaBase + margenError);

            if (!esVozValida) {
                mostrarAlerta(`
                    <h3 style="color: #EF4444; margin-bottom: 10px;">¡Alerta de Identidad!</h3>
                    <p>Hemos detectado un cambio notable en el tono de voz.</p>
                    <p style="margin-top: 10px; font-size: 0.9rem; color: #64748B;">Parece que no es el alumno quien lee. La práctica fue cancelada.</p>
                `, 'error');
                cambiarPantalla('pantalla-niveles-lectura');
                return;
            }

            const segundosTranscurridos = Math.max(1, (Date.now() - tiempoInicioLectura) / 1000);
            await new Promise(r => setTimeout(r, 700)); 
            const precision = Math.round((palabrasReconocidasSet.size / palabrasOriginalesArray.length) * 100);
            const ppm = (segundosTranscurridos / 60) > 0 ? Math.round(palabrasReconocidasSet.size / (segundosTranscurridos / 60)) : 0;
            const idAlumno = sessionStorage.getItem('id_alumno_activo');
            
            if (idAlumno && modoRepasoLectura) {
                if (precision >= PRECISION_MINIMA_LECTURA) {
                    await registrarPracticaParaRacha();
                    indiceFraseLecturaActual++;
                    if (indiceFraseLecturaActual >= 5) {
                        modoRepasoLectura = false;
                        mostrarAlerta('<h3 style="color: #10B981; margin-bottom: 10px;">¡Repaso completado!</h3><p style="font-size: 0.9rem; color: #64748B;">Repasar niveles que ya pasaste no suma puntos.</p>', 'exito');
                        cambiarPantalla('pantalla-niveles-lectura');
                    } else {
                        mostrarAlerta(`<h3 style="color: #10B981; margin-bottom: 10px;">¡Muy bien!</h3><p><b>🚀 Velocidad:</b> ${ppm} PPM</p><p><b>🎯 Precisión:</b> ${precision}%</p><p style="margin-top: 10px; font-size: 0.9rem; color: #64748B;">Repaso: ${indiceFraseLecturaActual} de 5 frases. Este repaso no suma puntos.</p>`, 'exito');
                        prepararModuloLectura();
                    }
                } else {
                    mostrarAlerta(`<h3 style="color: #EF4444; margin-bottom: 10px;">Casi</h3><p>Lograste un <b>${precision}%</b> de precisión. Necesitas ${PRECISION_MINIMA_LECTURA}%. ¡Inténtalo de nuevo!</p>`, 'error');
                    prepararModuloLectura();
                }
                return;
            }
            if (idAlumno) {
                await _supabase.from('sesiones_lectura').insert([{ id_usuario: idAlumno, ppm: ppm }]);
                if (precision >= PRECISION_MINIMA_LECTURA) {
                    await registrarPracticaParaRacha();
                    let progreso = await obtenerProgresoAlumno();
                    if (nivelLecturaSeleccionado === 'facil') progreso.lecturas_facil = (progreso.lecturas_facil || 0) + 1;
                    if (nivelLecturaSeleccionado === 'medio') progreso.lecturas_medio = (progreso.lecturas_medio || 0) + 1;
                    if (nivelLecturaSeleccionado === 'avanzado') progreso.lecturas_avanzado = (progreso.lecturas_avanzado || 0) + 1;
                    await guardarProgresoAlumno(progreso);
                    await actualizarInterfazNivelesLectura();
                    const frasesCompletadasEnCirculo = (progreso[`lecturas_${nivelLecturaSeleccionado}`] || 0) % 5;
                    const mensajeProgreso = frasesCompletadasEnCirculo === 0
                        ? '¡Completaste las cinco frases de este círculo! Ya puedes seguir con el siguiente.'
                        : `Llevas ${frasesCompletadasEnCirculo} de 5 frases. ¡Una más para completar este círculo!`;

                    mostrarAlerta(`
                        <h3 style="color: #10B981; margin-bottom: 10px;">¡Frase completada!</h3>
                        <p><b>⏱️ Tiempo:</b> ${Math.round(segundosTranscurridos)}s</p>
                        <p><b>🚀 Velocidad:</b> ${ppm} PPM</p>
                        <p><b>🎯 Precisión:</b> ${precision}%</p>
                        <p style="margin-top: 10px; font-size: 0.9rem; color: #64748B;">${mensajeProgreso}</p>
                    `, 'exito');
                } else {
                    mostrarAlerta(`
                        <h3 style="color: #EF4444; margin-bottom: 10px;">Lectura Reprobada</h3>
                        <p>Lograste un <b>${precision}%</b> de precisión.</p>
                        <p style="margin-top: 10px; font-size: 0.9rem; color: #64748B;">Necesitas al menos ${PRECISION_MINIMA_LECTURA}% para aprobar. ¡Inténtalo de nuevo!</p>
                    `, 'error');
                }
            }
            cambiarPantalla('pantalla-niveles-lectura');
        }

        function detenerLecturaYVolver() {
            lecturaVozActiva = false;
            if (reconocimientoVoz) { try { reconocimientoVoz.stop(); } catch(e) {} }
            cambiarPantalla('pantalla-niveles-lectura');
        }
