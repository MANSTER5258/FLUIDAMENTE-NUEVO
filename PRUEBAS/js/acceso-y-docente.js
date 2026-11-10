async function registrarDocente() {
            const nombre = document.getElementById('reg-nombre').value.trim();
            const escuela = document.getElementById('reg-escuela').value.trim();
            const grupo = document.getElementById('reg-grupo').value.trim();
            const correo = document.getElementById('reg-correo').value.trim();
            const contrasena = document.getElementById('reg-pass').value.trim();

            if (!nombre || !correo || !contrasena || !escuela || !grupo) {
                return mostrarAlerta('Por favor completa todos los campos (Escuela y Grupo son obligatorios).', 'error');
            }

            const { data: existeCorreo } = await _supabase.from('usuarios').select('correo').eq('correo', correo).maybeSingle();
            if (existeCorreo) {
                return mostrarAlerta('Este correo electrónico ya está registrado en la base de datos. Por favor, ve al inicio de sesión.', 'error');
            }

            const { data: authData, error: authError } = await _supabase.auth.signUp({ email: correo, password: contrasena });
            if (authError) return mostrarAlerta('Hubo un error con tu registro: ' + authError.message, 'error');
            if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
                 return mostrarAlerta('Este correo electrónico ya se encuentra en uso por otra cuenta.', 'error');
            }

            const { error } = await _supabase.from('usuarios').insert([{ nombre, rol: 'docente', correo, contrasena, escuela, grupo }]);
            if (error) return mostrarAlerta('Error al guardar datos: ' + error.message, 'error');

            mostrarAlerta(`
                <b>¡Registro en Pausa! ⏳</b><br><br>
                Hemos detectado tu solicitud, pero <b>tu cuenta aún no está activa</b>.<br><br>
                Para evitar correos falsos, hemos enviado un enlace de confirmación a <b>${correo}</b>.<br><br>
                Ve a tu bandeja de entrada (o SPAM), haz clic en el enlace para verificar tu identidad y luego inicia sesión.
            `, 'info');
            
            document.getElementById('reg-nombre').value = '';
            document.getElementById('reg-escuela').value = '';
            document.getElementById('reg-grupo').value = '';
            document.getElementById('reg-correo').value = '';
            document.getElementById('reg-pass').value = '';
            cambiarPantalla('pantalla-login');
        }

        async function loginDocente() {
            const correo = document.getElementById('docente-correo').value.trim();
            const contrasena = document.getElementById('docente-pass').value.trim();

            if (!correo || !contrasena) return mostrarAlerta('Ingresa tu correo y contraseña.', 'error');

            const { data: authData, error: authError } = await _supabase.auth.signInWithPassword({ email: correo, password: contrasena });
            if (authError) {
                if (authError.message.includes('Email not confirmed')) {
                    return mostrarAlerta('⚠️ <b>Acceso Denegado.</b><br><br>Tu cuenta está en pausa. Aún no has validado tu correo electrónico. Busca el enlace de activación en tu bandeja de entrada o SPAM.', 'error');
                }
                return mostrarAlerta('❌ Correo o contraseña incorrectos.', 'error');
            }

            const { data, error } = await _supabase.from('usuarios').select('*').eq('correo', correo).eq('rol', 'docente').single();
            if (error || !data) return mostrarAlerta('❌ Error crítico: Perfil de docente no encontrado en la base de datos.', 'error');

            sessionStorage.setItem('id_docente', data.id_usuario);
            sessionStorage.setItem('nombre_docente', data.nombre);

            cambiarPantalla('pantalla-maestro');
            await cargarEstructuraDocente();
        }

        function cerrarSesion() {
            sessionStorage.clear();
            _supabase.auth.signOut();
            cambiarPantalla('pantalla-login');
        }

        async function cargarEstructuraDocente(escuelaForzar = null, grupoForzar = null) {
            const idDocente = sessionStorage.getItem('id_docente');
            if (!idDocente) { cerrarSesion(); return; }

            const { data: maestro } = await _supabase.from('usuarios').select('escuela, grupo').eq('id_usuario', idDocente).single();
            const { data: alumnos } = await _supabase.from('usuarios').select('escuela, grupo').eq('id_docente', idDocente).eq('rol', 'alumno');
            
            escuelasYGrupos = {};
            
            if (maestro && maestro.escuela && maestro.grupo) {
                if(!escuelasYGrupos[maestro.escuela]) escuelasYGrupos[maestro.escuela] = new Set();
                escuelasYGrupos[maestro.escuela].add(maestro.grupo);
            }
            if (alumnos) {
                alumnos.forEach(a => {
                    const esc = a.escuela || 'Escuela No Asignada'; const grp = a.grupo || 'Grupo No Asignado';
                    if(!escuelasYGrupos[esc]) escuelasYGrupos[esc] = new Set();
                    escuelasYGrupos[esc].add(grp);
                });
            }
            if (Object.keys(escuelasYGrupos).length === 0) escuelasYGrupos['Principal'] = new Set(['General']);

            const selEscuela = document.getElementById('select-escuela-docente');
            selEscuela.innerHTML = '';
            
            Object.keys(escuelasYGrupos).forEach(esc => {
                const opt = document.createElement('option');
                opt.value = esc; opt.text = esc; selEscuela.add(opt);
            });

            if (escuelaForzar && escuelasYGrupos[escuelaForzar]) selEscuela.value = escuelaForzar;
            cambiarEscuela(grupoForzar);
        }

        function cambiarEscuela(grupoForzar = null) {
            const selEscuela = document.getElementById('select-escuela-docente').value;
            const selGrupo = document.getElementById('select-grupo-docente');
            selGrupo.innerHTML = '';

            const opcionInicial = document.createElement('option');
            opcionInicial.value = '';
            opcionInicial.text = 'Selecciona un grupo';
            opcionInicial.disabled = true;
            opcionInicial.selected = true;
            selGrupo.add(opcionInicial);
            
            if (selEscuela && escuelasYGrupos[selEscuela]) {
                escuelasYGrupos[selEscuela].forEach(grp => {
                    if (grp === 'General') return;
                    const opt = document.createElement('option');
                    opt.value = grp; opt.text = grp; selGrupo.add(opt);
                });
            }
            if (grupoForzar && grupoForzar !== 'General' && escuelasYGrupos[selEscuela] && escuelasYGrupos[selEscuela].has(grupoForzar)) selGrupo.value = grupoForzar;
            cargarAlumnos();
        }

        async function cargarAlumnos() {
            const idDocente = sessionStorage.getItem('id_docente');
            if (!idDocente) return;

            const selEscuela = document.getElementById('select-escuela-docente').value;
            const selGrupo = document.getElementById('select-grupo-docente').value;
            const tbody = document.getElementById('tabla-alumnos-body');
            tbody.innerHTML = '';
            const mensaje = texto => { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">${texto}</td></tr>`; };

            if (!selGrupo) return mensaje('Selecciona un grupo para ver sus alumnos.');
            if (!selEscuela) return mensaje('Selecciona una escuela primero.');

            const { data, error } = await _supabase.from('usuarios').select('*').eq('id_docente', idDocente).eq('rol', 'alumno').eq('escuela', selEscuela).eq('grupo', selGrupo);
            if (error || !data || data.length === 0) return mensaje('No hay alumnos registrados en este grupo.');

            const ids = data.map(a => a.id_usuario);
            const [{ data: sesiones }, { data: rachas }] = await Promise.all([
                _supabase.from('sesiones_lectura').select('id_usuario, ppm').in('id_usuario', ids),
                _supabase.from('rachas').select('id_usuario, dias_consecutivos, ultima_lectura').in('id_usuario', ids)
            ]);

            const filas = document.createDocumentFragment();
            data.forEach(alumno => {
                const propias = (sesiones || []).filter(s => s.id_usuario === alumno.id_usuario);
                const ppm = propias.length ? Math.round(propias.reduce((suma, s) => suma + (s.ppm || 0), 0) / propias.length) : 0;
                const racha = (rachas || []).find(r => r.id_usuario === alumno.id_usuario);
                const dias = racha ? calcularRachaVisual(parseInt(racha.dias_consecutivos), racha.ultima_lectura) : 0;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td data-label="Alumno"><strong>${escaparHTML(alumno.nombre)}</strong></td>
                    <td data-label="Código familiar"><span class="codigo-badge">${escaparHTML(alumno.codigo_acceso)}</span></td>
                    <td data-label="Promedio PPM" class="texto-cian">${ppm} PPM</td>
                    <td data-label="Racha actual">🔥 ${dias} días</td>
                    <td data-label="Acciones"><div class="acciones-alumno"></div></td>`;
                const acciones = tr.querySelector('.acciones-alumno');
                [
                    ['✎ Editar', '', () => editarAlumno(alumno)],
                    ['⇄ Cambiar de grupo', 'btn-fila-mover', () => cambiarAlumnoDeGrupo(alumno, selEscuela, selGrupo)],
                    ['Eliminar', 'btn-fila-eliminar', () => eliminarAlumno(alumno.id_usuario)]
                ].forEach(([texto, clase, accion]) => {
                    const boton = document.createElement('button');
                    boton.type = 'button';
                    boton.className = ('btn-texto btn-fila-alumno ' + clase).trim();
                    boton.textContent = texto;
                    boton.addEventListener('click', accion);
                    acciones.appendChild(boton);
                });
                filas.appendChild(tr);
            });
            tbody.appendChild(filas);
        }

        function editarAlumno(alumno) {
            const idDocente = sessionStorage.getItem('id_docente');
            const selEscuela = document.getElementById('select-escuela-docente').value;
            const selGrupo = document.getElementById('select-grupo-docente').value;
            abrirModalCustom("Editar alumno", "Nombre completo del alumno", async function(nuevoNombre) {
                const nombre = (nuevoNombre || '').trim();
                if (!nombre || nombre === alumno.nombre) return;
                const { error } = await _supabase.from('usuarios').update({ nombre }).eq('id_usuario', alumno.id_usuario).eq('id_docente', idDocente);
                if (error) return mostrarAlerta('Error al actualizar al alumno: ' + escaparHTML(error.message), 'error');
                mostrarAlerta('¡Los datos del alumno se actualizaron!', 'exito');
                await cargarEstructuraDocente(selEscuela, selGrupo);
            });
            const entrada = document.getElementById('modal-input-texto');
            entrada.value = alumno.nombre;
            entrada.select();
        }

        function cambiarAlumnoDeGrupo(alumno, escuela, grupoActual) {
            const destinos = [...(escuelasYGrupos[escuela] || [])].filter(g => g !== 'General' && g !== grupoActual);
            if (destinos.length === 0) return mostrarAlerta('No hay otro grupo en esta escuela. Crea uno con el botón + junto a "Grupo" y vuelve a intentarlo.', 'error');
            const opciones = destinos.map(g => `<option value="${escaparHTML(g)}">${escaparHTML(g)}</option>`).join('');
            mostrarConfirmacion(
                `Mover a <b>${escaparHTML(alumno.nombre)}</b> de <b>${escaparHTML(grupoActual)}</b> a:<br><br>` +
                `<select id="select-grupo-destino" class="input-form">${opciones}</select><br>` +
                `Conserva su código, su racha y todo su progreso.`,
                async function() {
                    const destino = document.getElementById('select-grupo-destino').value;
                    const idDocente = sessionStorage.getItem('id_docente');
                    const { error } = await _supabase.from('usuarios').update({ grupo: destino }).eq('id_usuario', alumno.id_usuario).eq('id_docente', idDocente).eq('escuela', escuela);
                    if (error) return mostrarAlerta('Error al cambiar de grupo: ' + escaparHTML(error.message), 'error');
                    mostrarAlerta(`<b>${escaparHTML(alumno.nombre)}</b> ahora está en <b>${escaparHTML(destino)}</b>.`, 'exito');
                    await cargarEstructuraDocente(escuela, grupoActual);
                }
            );
        }

        async function generarCodigoUnico() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            for (let intento = 0; intento < 8; intento++) {
                let codigo = 'FLU-';
                for (let i = 0; i < 3; i++) codigo += chars.charAt(Math.floor(Math.random() * chars.length));
                const { data } = await _supabase.from('usuarios').select('id_usuario').eq('codigo_acceso', codigo).limit(1);
                if (!data || data.length === 0) return codigo;
            }
            return 'FLU-' + Date.now().toString(36).slice(-4).toUpperCase();
        }

        function crearNuevaEscuela() {
            abrirModalCustom("Agregar Escuela Nueva", "Nombre de la escuela", async function(nuevaEscuela) {
                if (!nuevaEscuela || !nuevaEscuela.trim()) return;
                const nombreLimpio = nuevaEscuela.trim();
                const idDocente = sessionStorage.getItem('id_docente');
                const { error } = await _supabase.from('usuarios').update({ escuela: nombreLimpio, grupo: 'General' }).eq('id_usuario', idDocente);
                if (error) return mostrarAlerta('Error al agregar la escuela: ' + escaparHTML(error.message), 'error');
                await cargarEstructuraDocente(nombreLimpio, 'General');
            });
        }

        function crearNuevoGrupo() {
            const selEscuela = document.getElementById('select-escuela-docente').value;
            if(!selEscuela) return mostrarAlerta('Primero debes crear o seleccionar una escuela.', 'error');

            abrirModalCustom("Agregar Grupo Nuevo", `Para la escuela: ${selEscuela}`, async function(nuevoGrupo) {
                if (!nuevoGrupo || !nuevoGrupo.trim()) return;
                const nombreLimpio = nuevoGrupo.trim();
                const idDocente = sessionStorage.getItem('id_docente');
                const { error } = await _supabase.from('usuarios').update({ escuela: selEscuela, grupo: nombreLimpio }).eq('id_usuario', idDocente);
                if (error) return mostrarAlerta('Error al agregar el grupo: ' + escaparHTML(error.message), 'error');
                await cargarEstructuraDocente(selEscuela, nombreLimpio);
            });
        }

        let escuelaAdministracionAbierta = null;

        function crearBotonMenuAdministracion(texto, clase, accion) {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = clase;
            boton.textContent = texto;
            boton.addEventListener('click', function(event) {
                event.stopPropagation();
                accion();
            });
            return boton;
        }

        function renderizarMenuAdministracion() {
            const contenido = document.getElementById('menu-administracion-contenido');
            contenido.replaceChildren();

            if (escuelaAdministracionAbierta === null) {
                const encabezado = document.createElement('div');
                encabezado.className = 'menu-vista-encabezado';
                encabezado.innerHTML = '<span class="menu-vista-kicker">ADMINISTRACIÓN</span><strong>Selecciona una escuela</strong><span>Elige una para ver sus opciones y grupos.</span>';
                contenido.appendChild(encabezado);

                const listaEscuelas = document.createElement('div');
                listaEscuelas.className = 'menu-lista-escuelas';
                Object.entries(escuelasYGrupos).forEach(([escuela, grupos]) => {
                    const botonEscuela = crearBotonMenuAdministracion('', 'menu-escuela-item', function() {
                        escuelaAdministracionAbierta = escuela;
                        renderizarMenuAdministracion();
                    });
                    const icono = document.createElement('span');
                    icono.className = 'menu-escuela-icono';
                    icono.textContent = '🏫';
                    const detalles = document.createElement('span');
                    detalles.className = 'menu-escuela-detalles';
                    const nombre = document.createElement('strong');
                    nombre.textContent = escuela;
                    const cantidadGrupos = [...grupos].filter(grupo => grupo !== 'General').length;
                    const resumen = document.createElement('small');
                    resumen.textContent = `${cantidadGrupos} ${cantidadGrupos === 1 ? 'grupo' : 'grupos'}`;
                    const flecha = document.createElement('span');
                    flecha.className = 'menu-escuela-flecha';
                    flecha.textContent = '›';
                    detalles.append(nombre, resumen);
                    botonEscuela.append(icono, detalles, flecha);
                    listaEscuelas.appendChild(botonEscuela);
                });
                contenido.appendChild(listaEscuelas);
                return;
            }

            const escuela = escuelaAdministracionAbierta;
            const grupos = escuelasYGrupos[escuela];
            if (!grupos) {
                escuelaAdministracionAbierta = null;
                renderizarMenuAdministracion();
                return;
            }

            const volver = crearBotonMenuAdministracion('‹ Todas las escuelas', 'menu-volver', function() {
                escuelaAdministracionAbierta = null;
                renderizarMenuAdministracion();
            });
            contenido.appendChild(volver);

            const encabezadoEscuela = document.createElement('div');
            encabezadoEscuela.className = 'menu-vista-encabezado menu-vista-escuela';
            const etiqueta = document.createElement('span');
            etiqueta.className = 'menu-vista-kicker';
            etiqueta.textContent = 'ESCUELA';
            const nombreEscuela = document.createElement('strong');
            nombreEscuela.textContent = escuela;
            encabezadoEscuela.append(etiqueta, nombreEscuela);
            contenido.appendChild(encabezadoEscuela);

            const accionesEscuela = document.createElement('div');
            accionesEscuela.className = 'menu-acciones-escuela';
            accionesEscuela.append(
                crearBotonMenuAdministracion('✎  Cambiar nombre de escuela', 'menu-accion-boton', () => editarEscuelaActual(escuela)),
                crearBotonMenuAdministracion('×  Eliminar escuela, grupos y alumnos', 'menu-accion-boton menu-accion-peligro', () => eliminarEscuelaActual(escuela))
            );
            contenido.appendChild(accionesEscuela);

            const cabeceraGrupos = document.createElement('div');
            cabeceraGrupos.className = 'menu-grupos-encabezado';
            const tituloGrupos = document.createElement('strong');
            tituloGrupos.textContent = 'Grupos de esta escuela';
            const gruposVisibles = [...grupos].filter(grupo => grupo !== 'General');
            const contador = document.createElement('span');
            contador.textContent = String(gruposVisibles.length);
            cabeceraGrupos.append(tituloGrupos, contador);
            contenido.appendChild(cabeceraGrupos);

            if (gruposVisibles.length === 0) {
                const vacio = document.createElement('p');
                vacio.className = 'menu-grupos-vacio';
                vacio.textContent = 'Todavía no hay grupos creados en esta escuela.';
                contenido.appendChild(vacio);
                return;
            }

            const listaGrupos = document.createElement('div');
            listaGrupos.className = 'menu-lista-grupos';
            gruposVisibles.forEach(grupo => {
                const fila = document.createElement('div');
                fila.className = 'menu-grupo-fila';
                const nombre = document.createElement('span');
                nombre.className = 'menu-grupo-nombre';
                nombre.textContent = grupo;
                const acciones = document.createElement('div');
                acciones.className = 'menu-grupo-acciones';
                const editar = crearBotonMenuAdministracion('✎', 'menu-grupo-accion', () => editarGrupoActual(escuela, grupo));
                editar.title = `Cambiar nombre de ${grupo}`;
                editar.setAttribute('aria-label', `Cambiar nombre de ${grupo}`);
                const eliminar = crearBotonMenuAdministracion('×', 'menu-grupo-accion menu-accion-peligro', () => eliminarGrupoActual(escuela, grupo));
                eliminar.title = `Eliminar ${grupo}`;
                eliminar.setAttribute('aria-label', `Eliminar ${grupo}`);
                acciones.append(editar, eliminar);
                fila.append(nombre, acciones);
                listaGrupos.appendChild(fila);
            });
            contenido.appendChild(listaGrupos);
        }

        function toggleMenuAdministracion() {
            const menu = document.getElementById('menu-administracion');
            const boton = document.querySelector('button[onclick="toggleMenuAdministracion()"]');
            const estaAbierto = menu.classList.contains('oculta');
            if (estaAbierto) {
                escuelaAdministracionAbierta = null;
                renderizarMenuAdministracion();
                menu.classList.remove('oculta');
            } else {
                menu.classList.add('oculta');
            }
            boton.setAttribute('aria-expanded', String(estaAbierto));
        }
        document.addEventListener('click', function(event) {
            const menu = document.getElementById('menu-administracion');
            const btn = event.target.closest('button[onclick="toggleMenuAdministracion()"]');
            if (!btn && menu && !menu.contains(event.target)) {
                menu.classList.add('oculta');
                document.querySelector('button[onclick="toggleMenuAdministracion()"]').setAttribute('aria-expanded', 'false');
            }
        });

        function cerrarMenuAdministracion() {
            document.getElementById('menu-administracion').classList.add('oculta');
            document.querySelector('button[onclick="toggleMenuAdministracion()"]').setAttribute('aria-expanded', 'false');
        }

        function editarGrupoActual(escuelaObjetivo = null, grupoObjetivo = null) {
            cerrarMenuAdministracion();
            const grupoAntiguo = grupoObjetivo || document.getElementById('select-grupo-docente').value;
            const escuelaActual = escuelaObjetivo || document.getElementById('select-escuela-docente').value;
            
            if (grupoAntiguo === 'General') return mostrarAlerta("El grupo 'General' está protegido por el sistema y no se puede editar.", 'error');
            if (!grupoAntiguo || !escuelaActual || !escuelasYGrupos[escuelaActual]) return mostrarAlerta('Selecciona un grupo válido para actualizar.', 'error');

            abrirModalCustom("Renombrar Grupo", `Nuevo nombre para "${grupoAntiguo}"`, async function(nuevoNombre) {
                if (!nuevoNombre || !nuevoNombre.trim()) return;
                const nombreLimpio = nuevoNombre.trim();
                if (escuelasYGrupos[escuelaActual].has(nombreLimpio)) return mostrarAlerta('Ya existe un grupo con ese nombre en esta escuela.', 'error');
                const idDocente = sessionStorage.getItem('id_docente');
                
                const { error: alumnosError } = await _supabase.from('usuarios').update({ grupo: nombreLimpio }).eq('id_docente', idDocente).eq('escuela', escuelaActual).eq('grupo', grupoAntiguo).eq('rol', 'alumno');
                if (alumnosError) return mostrarAlerta('Error al actualizar el grupo: ' + escaparHTML(alumnosError.message), 'error');
                const { error: docenteError } = await _supabase.from('usuarios').update({ grupo: nombreLimpio }).eq('id_usuario', idDocente).eq('escuela', escuelaActual).eq('grupo', grupoAntiguo);
                if (docenteError) {
                    mostrarAlerta('El grupo de los alumnos se actualizó, pero no se pudo actualizar el perfil docente: ' + escaparHTML(docenteError.message), 'error');
                    await cargarEstructuraDocente(escuelaActual, grupoAntiguo);
                    return;
                }

                mostrarAlerta('¡El grupo ha sido renombrado exitosamente!', 'exito');
                await cargarEstructuraDocente(escuelaActual, nombreLimpio);
            });
        }

        function eliminarGrupoActual(escuelaObjetivo = null, grupoObjetivo = null) {
            cerrarMenuAdministracion();
            const grupoAEliminar = grupoObjetivo || document.getElementById('select-grupo-docente').value;
            const escuelaActual = escuelaObjetivo || document.getElementById('select-escuela-docente').value;

            if (grupoAEliminar === 'General') return mostrarAlerta("El grupo 'General' no se puede eliminar.", 'error');
            if (!grupoAEliminar || !escuelaActual || !escuelasYGrupos[escuelaActual]) return mostrarAlerta('Selecciona un grupo válido para eliminar.', 'error');

            mostrarConfirmacion(`¿Seguro que deseas eliminar el grupo <b>"${escaparHTML(grupoAEliminar)}"</b>?<br><br>También se eliminarán permanentemente las cuentas de todos los alumnos de este grupo. Esta acción no se puede deshacer.`, async function() {
                const idDocente = sessionStorage.getItem('id_docente');
                const { error: alumnosError } = await _supabase.from('usuarios').delete().eq('id_docente', idDocente).eq('escuela', escuelaActual).eq('grupo', grupoAEliminar).eq('rol', 'alumno');
                if (alumnosError) return mostrarAlerta('Error al eliminar el grupo: ' + escaparHTML(alumnosError.message), 'error');
                const { error: docenteError } = await _supabase.from('usuarios').update({ grupo: 'General' }).eq('id_usuario', idDocente).eq('escuela', escuelaActual).eq('grupo', grupoAEliminar);
                if (docenteError) {
                    mostrarAlerta('Las cuentas de los alumnos se eliminaron, pero no se pudo actualizar el grupo del perfil docente: ' + escaparHTML(docenteError.message), 'error');
                    await cargarEstructuraDocente(escuelaActual, grupoAEliminar);
                    return;
                }

                mostrarAlerta('El grupo y las cuentas de sus alumnos se eliminaron correctamente.', 'exito');
                const grupoDestino = [...escuelasYGrupos[escuelaActual]].find(grupo => grupo !== 'General') || null;
                await cargarEstructuraDocente(escuelaActual, grupoDestino);
            });
        }

        function editarEscuelaActual(escuelaObjetivo = null) {
            cerrarMenuAdministracion();
            const escuelaActual = escuelaObjetivo || document.getElementById('select-escuela-docente').value;
            if (!escuelaActual) return mostrarAlerta('Selecciona una escuela primero.', 'error');

            abrirModalCustom("Actualizar escuela", `Nuevo nombre para "${escuelaActual}"`, async function(nuevoNombre) {
                if (!nuevoNombre || !nuevoNombre.trim()) return;
                const nombreLimpio = nuevoNombre.trim();
                if (nombreLimpio === escuelaActual) return;
                if (escuelasYGrupos[nombreLimpio]) return mostrarAlerta('Ya existe una escuela con ese nombre.', 'error');
                const idDocente = sessionStorage.getItem('id_docente');

                const { error: alumnosError } = await _supabase.from('usuarios').update({ escuela: nombreLimpio }).eq('id_docente', idDocente).eq('escuela', escuelaActual).eq('rol', 'alumno');
                if (alumnosError) return mostrarAlerta('Error al actualizar la escuela: ' + escaparHTML(alumnosError.message), 'error');
                const { error: docenteError } = await _supabase.from('usuarios').update({ escuela: nombreLimpio }).eq('id_usuario', idDocente).eq('escuela', escuelaActual);
                if (docenteError) {
                    mostrarAlerta('Los alumnos se actualizaron, pero no se pudo actualizar el perfil docente: ' + escaparHTML(docenteError.message), 'error');
                    await cargarEstructuraDocente(escuelaActual);
                    return;
                }

                mostrarAlerta('¡La escuela se actualizó correctamente!', 'exito');
                await cargarEstructuraDocente(nombreLimpio);
            });
        }

        function eliminarEscuelaActual(escuelaObjetivo = null) {
            cerrarMenuAdministracion();
            const escuelaAEliminar = escuelaObjetivo || document.getElementById('select-escuela-docente').value;
            if (!escuelaAEliminar) return mostrarAlerta('Selecciona una escuela primero.', 'error');

            const otrasEscuelas = Object.keys(escuelasYGrupos).filter(escuela => escuela !== escuelaAEliminar);
            const escuelaDestino = otrasEscuelas.includes('Principal')
                ? 'Principal'
                : (otrasEscuelas[0] || 'Escuela No Asignada');
            const gruposDestino = escuelasYGrupos[escuelaDestino];
            const grupoDestino = gruposDestino
                ? [...gruposDestino].find(grupo => grupo !== 'General') || 'Grupo No Asignado'
                : 'Grupo No Asignado';

            mostrarConfirmacion(`¿Seguro que deseas eliminar la escuela <b>"${escaparHTML(escuelaAEliminar)}"</b>, todos sus grupos y las cuentas de sus alumnos?<br><br>Esta acción es permanente y no se puede deshacer.`, async function() {
                const idDocente = sessionStorage.getItem('id_docente');
                const { error: alumnosError } = await _supabase.from('usuarios').delete().eq('id_docente', idDocente).eq('escuela', escuelaAEliminar).eq('rol', 'alumno');
                if (alumnosError) return mostrarAlerta('Error al eliminar las cuentas de los alumnos: ' + escaparHTML(alumnosError.message), 'error');
                const { error: docenteError } = await _supabase.from('usuarios').update({ escuela: escuelaDestino, grupo: grupoDestino }).eq('id_usuario', idDocente).eq('escuela', escuelaAEliminar);
                if (docenteError) {
                    mostrarAlerta('Las cuentas de los alumnos se eliminaron, pero no se pudo actualizar el perfil docente: ' + escaparHTML(docenteError.message), 'error');
                    await cargarEstructuraDocente(escuelaAEliminar);
                    return;
                }

                mostrarAlerta('La escuela, sus grupos y las cuentas de sus alumnos se eliminaron correctamente.', 'exito');
                await cargarEstructuraDocente(escuelaDestino, grupoDestino);
            });
        }

        function agregarAlumnoPrompt() {
            const idDocente = sessionStorage.getItem('id_docente');
            if (!idDocente) return cerrarSesion();
            const selEscuela = document.getElementById('select-escuela-docente').value;
            const selGrupo = document.getElementById('select-grupo-docente').value;
            if (!selEscuela || !selGrupo) return mostrarAlerta('Selecciona una escuela y un grupo primero.', 'error');

            abrirModalCustom("Agregar Nuevo Alumno", "Nombre completo del alumno", async function(nombreAlumno) {
                if (!nombreAlumno || !nombreAlumno.trim()) return;
                const codigo = await generarCodigoUnico();
                
                document.getElementById('modal-registro-voz').classList.remove('oculta');
                document.getElementById('nombre-alumno-voz').innerText = nombreAlumno.trim();
                const btnGrabar = document.getElementById('btn-grabar-voz');
                
                btnGrabar.onclick = async function() {
                    btnGrabar.innerText = "🎤 Escuchando...";
                    btnGrabar.disabled = true;
                    await iniciarCapturaFrecuencia();

                    setTimeout(async () => {
                        const frecuenciaObtenida = detenerCapturaFrecuencia();
                        document.getElementById('modal-registro-voz').classList.add('oculta');
                        btnGrabar.innerText = "Grabar (3 seg)";
                        btnGrabar.disabled = false;

                        const { error } = await _supabase.from('usuarios').insert([{
                            nombre: nombreAlumno.trim(), rol: 'alumno', codigo_acceso: codigo, 
                            id_docente: idDocente, escuela: selEscuela, grupo: selGrupo,
                            frecuencia_voz: frecuenciaObtenida
                        }]);

                        if (error) mostrarAlerta('Error al agregar: ' + error.message, 'error');
                        else {
                            mostrarAlerta(`<b>¡Alumno agregado correctamente!</b><br><br>Su Código de Acceso es:<br><br><span style="font-size:1.8rem; letter-spacing:3px; background:#f1f5f9; padding:5px 15px; border-radius:8px;">${codigo}</span>`, 'exito');
                            await cargarEstructuraDocente(selEscuela, selGrupo);
                        }
                    }, 3000);
                };
            });
        }

        function eliminarAlumno(idUsuario) {
            mostrarConfirmacion("¿Estás seguro de eliminar a este alumno de la plataforma de forma permanente?", async function() {
                const selEscuela = document.getElementById('select-escuela-docente').value;
                const selGrupo = document.getElementById('select-grupo-docente').value;
                const { error } = await _supabase.from('usuarios').delete().eq('id_usuario', idUsuario);
                
                if (error) mostrarAlerta('Error al eliminar: ' + error.message, 'error');
                else await cargarEstructuraDocente(selEscuela, selGrupo);
            });
        }
