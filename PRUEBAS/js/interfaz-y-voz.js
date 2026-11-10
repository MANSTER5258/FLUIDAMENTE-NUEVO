// --- SISTEMA DE MODALES PERSONALIZADOS ---
        function mostrarAlerta(mensaje, tipo = 'info') {
            const modal = document.getElementById('modal-alerta');
            const icono = document.getElementById('alerta-icono');
            const btn = document.getElementById('btn-alerta-ok');
            
            document.getElementById('alerta-mensaje').innerHTML = mensaje;
            
            if(tipo === 'exito') {
                icono.innerHTML = '✅';
                btn.style.backgroundColor = 'var(--verde-exito)';
                btn.style.boxShadow = '0 3px 0 #059669';
            } else if (tipo === 'error') {
                icono.innerHTML = '❌';
                btn.style.backgroundColor = 'var(--rojo-alerta)';
                btn.style.boxShadow = '0 3px 0 #B91C1C';
            } else {
                icono.innerHTML = 'ℹ️';
                btn.style.backgroundColor = 'var(--azul-primario)';
                btn.style.boxShadow = '0 3px 0 var(--azul-hover)';
            }
            
            modal.classList.remove('oculta');
            btn.onclick = () => modal.classList.add('oculta');
        }

        function mostrarConfirmacion(mensaje, callback) {
            const modal = document.getElementById('modal-confirmacion');
            document.getElementById('confirmacion-mensaje').innerHTML = mensaje.replace(/\n/g, '<br>');
            modal.classList.remove('oculta');
            
            document.getElementById('btn-confirmacion-ok').onclick = () => {
                modal.classList.add('oculta');
                callback();
            };
        }

        function escaparHTML(texto) {
            return String(texto).replace(/[&<>"']/g, caracter => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[caracter]);
        }

        function cerrarModalConfirmacion() {
            document.getElementById('modal-confirmacion').classList.add('oculta');
        }

        function obtenerFechaLocal() {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`; 
        }

        function calcularRachaVisual(diasGuardados, ultimaLectura) {
            if (!ultimaLectura || !diasGuardados) return 0;
            const hoy = obtenerFechaLocal();
            const fechaBD = ultimaLectura.substring(0, 10);
            if (fechaBD === hoy) return diasGuardados;
            
            const [yU, mU, dU] = fechaBD.split('-').map(Number);
            const [yH, mH, dH] = hoy.split('-').map(Number);
            const fU = new Date(yU, mU - 1, dU);
            const fH = new Date(yH, mH - 1, dH);
            const diferencia = Math.round((fH - fU) / (1000 * 60 * 60 * 24));
            
            if (diferencia === 1) return diasGuardados; 
            return 0; 
        }

        async function cargarRachaVisual() {
            const idAlumno = sessionStorage.getItem('id_alumno_activo');
            if (!idAlumno) return;
            let { data: rachaData } = await _supabase.from('rachas').select('*').eq('id_usuario', idAlumno).maybeSingle();
            let diasVisuales = rachaData ? calcularRachaVisual(parseInt(rachaData.dias_consecutivos), rachaData.ultima_lectura) : 0;
            document.getElementById('racha-dias').innerText = `${diasVisuales} día${diasVisuales !== 1 ? 's' : ''}`;
        }

        async function registrarPracticaParaRacha() {
            const idAlumno = sessionStorage.getItem('id_alumno_activo');
            if (!idAlumno) return;
            const hoy = obtenerFechaLocal(); 
            let { data: rachaData } = await _supabase.from('rachas').select('*').eq('id_usuario', idAlumno).maybeSingle();

            if (!rachaData) {
                await _supabase.from('rachas').insert([{ id_usuario: idAlumno, dias_consecutivos: 1, ultima_lectura: hoy }]);
                document.getElementById('racha-dias').innerText = '1 día';
            } else {
                const ultimaFechaBD = (rachaData.ultima_lectura || hoy).substring(0, 10);
                let nuevoDias = parseInt(rachaData.dias_consecutivos) || 0;

                if (ultimaFechaBD !== hoy) {
                    const [yU, mU, dU] = ultimaFechaBD.split('-').map(Number);
                    const [yH, mH, dH] = hoy.split('-').map(Number);
                    const fU = new Date(yU, mU - 1, dU);
                    const fH = new Date(yH, mH - 1, dH);
                    const diferencia = Math.round((fH - fU) / (1000 * 60 * 60 * 24));

                    if (diferencia === 1) nuevoDias += 1; 
                    else if (diferencia > 1) nuevoDias = 1; 

                    await _supabase.from('rachas').update({ dias_consecutivos: nuevoDias, ultima_lectura: hoy }).eq('id_usuario', idAlumno);
                    document.getElementById('racha-dias').innerText = `${nuevoDias} día${nuevoDias !== 1 ? 's' : ''}`;
                }
            }
        }

        // ===== RECONOCIMIENTO DE VOZ =====
        const TOLERANCIA_PALABRA_LARGA = 6; 
        const ALIAS_SILABAS = {};
        let lecturaVozActiva = false;
        let tokensPreviosVoz = [];
        let sesionPalabraId = 0;

        function limpiarTexto(texto) {
            return (texto || "").toLowerCase()
                .replace(/ñ/g, "ɲ").replace(/ü/g, "w")
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^\p{L}\p{N}\s]/gu, " ")
                .replace(/\s+/g, " ").trim();
        }

        function claveFonetica(p) {
            return p
                .replace(/(?<!c)h/g, "")
                .replace(/ch/g, "ʧ")
                .replace(/ll/g, "y")
                .replace(/rr/g, "R").replace(/^r/, "R")
                .replace(/qu/g, "k").replace(/q/g, "k")
                .replace(/g(?=[ei])/g, "j")
                .replace(/gu(?=[ei])/g, "g")
                .replace(/c(?=[ei])/g, "s").replace(/c/g, "k")
                .replace(/z/g, "s").replace(/v/g, "b").replace(/x/g, "ks")
                .replace(/y$/, "i")
                .replace(/([^aeiouR])\1+/g, "$1");
        }

        function normalizarFonetica(texto) {
            return limpiarTexto(texto).split(" ").filter(Boolean).map(claveFonetica).join(" ");
        }

        function distanciaEdicion(a, b) {
            const f = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
            for (let j = 1; j <= b.length; j++) f[0][j] = j;
            for (let i = 1; i <= a.length; i++)
                for (let j = 1; j <= b.length; j++)
                    f[i][j] = Math.min(f[i - 1][j] + 1, f[i][j - 1] + 1, f[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            return f[a.length][b.length];
        }

        function sonIguales(objetivo, dicho) {
            if (!objetivo || !dicho) return false;
            if (objetivo === dicho) return true;
            return objetivo.length >= TOLERANCIA_PALABRA_LARGA && distanciaEdicion(objetivo, dicho) <= 1;
        }

        function esPalabraCorrecta(dicho, objetivo) {
            const objRaw = limpiarTexto(objetivo);
            const objetivoClave = normalizarFonetica(objetivo);
            const rawTokens = limpiarTexto(dicho).split(" ").filter(Boolean);
            const tokens = rawTokens.map(claveFonetica);
            if (!objetivoClave || !tokens.length) return false;
            const candidatos = [...tokens, tokens.join("")];
            if (candidatos.includes(objetivoClave)) return true;
            if (objRaw.length <= 3) {
                const colapsa = s => s.replace(/([aeiou])\1+/g, "$1");
                if (candidatos.some(c => colapsa(c) === colapsa(objetivoClave))) return true;
                const m = objRaw.match(/^(ch|[bcdgptv])e$/);
                if (m) {
                    const letras = m[1] === "v" ? ["v", "b"] : m[1] === "b" ? ["b", "v"] : [m[1]];
                    if (rawTokens.some(tk => letras.includes(tk))) return true;
                }
                return (ALIAS_SILABAS[objRaw] || []).some(a => candidatos.includes(normalizarFonetica(a)));
            }
            return candidatos.some(c => sonIguales(objetivoClave, c));
        }

        // ===== SINTESIS DE VOZ =====
        const VELOCIDAD_VOZ = 0.85; 
        const VOZ_PREFERIDA = "";   
        let vozElegida = null;

        function elegirVozEspanol() {
            const voces = window.speechSynthesis.getVoices().filter(v => (v.lang || "").toLowerCase().startsWith("es"));
            if (!voces.length) return null;
            if (VOZ_PREFERIDA) {
                const elegida = voces.find(v => v.name.includes(VOZ_PREFERIDA));
                if (elegida) return elegida;
            }
            const puntos = v => {
                const lang = (v.lang || "").replace("_", "-").toLowerCase();
                let p = lang === "es-mx" ? 30 : (lang === "es-us" || lang === "es-419") ? 25 : lang === "es-es" ? 5 : 1;
                if (/natural|neural|online/i.test(v.name)) p += 100;
                if (/google/i.test(v.name)) p += 60;
                if (/espeak|compact/i.test(v.name)) p -= 50;
                return p;
            };
            return voces.sort((x, y) => puntos(y) - puntos(x))[0];
        }

        if ("speechSynthesis" in window) { 
            vozElegida = elegirVozEspanol();
            window.speechSynthesis.addEventListener("voiceschanged", () => { vozElegida = elegirVozEspanol(); });
        }

        // Revisa lo que necesita el micrófono. Devuelve el mensaje del problema, o "" si todo está bien.
        function diagnosticarVoz() {
            const ua = navigator.userAgent;
            const esIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
            if (!window.isSecureContext) return "🔒 El micrófono solo funciona en páginas seguras (que empiecen con https://). Abre la app desde su dirección https:// y vuelve a intentarlo.";
            if (/FBAN|FBAV|Instagram|WhatsApp|Line\/|MicroMessenger|; wv\)/i.test(ua)) return "📱 Estás en el navegador interno de otra app. Abre el enlace en " + (esIOS ? "Safari" : "Chrome") + " para poder usar el micrófono.";
            if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) return esIOS
                ? "📱 En iPhone y iPad el micrófono solo funciona en Safari (iOS 14.5 o más nuevo), con Dictado activado en Ajustes → General → Teclado."
                : "Tu navegador no soporta reconocimiento de voz. Usa Google Chrome.";
            if (!navigator.onLine) return "📶 Sin internet. El reconocimiento de voz la necesita; revisa tu conexión.";
            return "";
        }

        // Pasa en teléfonos sin los servicios de Google (por ejemplo Huawei recientes): el navegador no tiene con qué reconocer la voz
        const MENSAJE_SERVICIO_VOZ = "🔧 Este dispositivo no puede usar el reconocimiento de voz del navegador. Suele pasar en teléfonos Huawei sin servicios de Google. Prueba con otro celular, una tablet o una computadora.";

        let avisoVozMostrado = false;
        function avisarFalloSonido() {
            if (avisoVozMostrado) return;
            avisoVozMostrado = true;
            mostrarAlerta("🔇 No pude reproducir el sonido. Revisa el volumen multimedia, que el modo silencio esté apagado (iPhone o iPad) y que el dispositivo tenga una voz en español (Android: Ajustes → Sistema → Idioma → Salida de texto a voz). En Huawei sin servicios de Google es común que falte esa voz.", 'error');
        }

        function pronunciar(texto) {
            if (!("speechSynthesis" in window)) return mostrarAlerta("Este navegador no puede reproducir voz. Usa Chrome (Android) o Safari (iPhone y iPad).", 'error');
            const limpio = (texto || "").replace(/[.,;:!?¡¿"()]/g, "").trim();
            if (!limpio) return;
            const sintetizador = window.speechSynthesis;
            const enunciado = new SpeechSynthesisUtterance(limpio);
            const voz = vozElegida || elegirVozEspanol();
            enunciado.lang = voz ? (voz.lang || "es-MX").replace("_", "-") : "es-MX"; // Android escribe "es_MX", que no es válido
            if (voz) enunciado.voice = voz;
            enunciado.rate = VELOCIDAD_VOZ;
            enunciado.volume = 1; // volumen máximo de la app; el resto lo da el volumen del dispositivo
            let empezo = false;
            enunciado.onstart = () => { empezo = true; };
            enunciado.onerror = (e) => { if (e.error !== "canceled" && e.error !== "interrupted") avisarFalloSonido(); };
            const hablar = () => {
                try { sintetizador.resume(); } catch (e) {}
                sintetizador.speak(enunciado);
                setTimeout(() => { if (!empezo && !sintetizador.speaking) avisarFalloSonido(); }, 2500);
            };
            if (sintetizador.speaking || sintetizador.pending) { sintetizador.cancel(); setTimeout(hablar, 80); } else { hablar(); }
        }

        function hacerHablable(elemento, obtenerTexto, antes) {
            elemento.classList.add("hablable");
            elemento.setAttribute("role", "button");
            elemento.setAttribute("tabindex", "0");
            elemento.setAttribute("title", "Toca para escuchar");
            const alActivar = (e) => {
                if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                if (lecturaVozActiva) return; 
                if (antes) antes();
                pronunciar(obtenerTexto());
                elemento.classList.add("pronunciando");
                setTimeout(() => elemento.classList.remove("pronunciando"), 700);
            };
            elemento.addEventListener("click", alActivar);
            elemento.addEventListener("keydown", alActivar);
        }

        function detenerMicroModal() {
            sesionPalabraId++;
            if (reconocimientoVoz) { try { reconocimientoVoz.abort(); } catch(e) {} }
            document.getElementById('modal-palabra-estado').innerText = "Presiona 'Hablar' y di la palabra en voz alta.";
        }

        async function obtenerProgresoAlumno() {
            const idAlumno = sessionStorage.getItem('id_alumno_activo');
            if (!idAlumno) return { facil: 0, medio: 0, avanzado: 0, lecturas_facil: 0, lecturas_medio: 0, lecturas_avanzado: 0 };
            const { data } = await _supabase.from('usuarios').select('progreso_facil, progreso_medio, progreso_avanzado, lecturas_facil, lecturas_medio, lecturas_avanzado').eq('id_usuario', idAlumno).single();
            if (!data) return { facil: 0, medio: 0, avanzado: 0, lecturas_facil: 0, lecturas_medio: 0, lecturas_avanzado: 0 };
            return { facil: data.progreso_facil || 0, medio: data.progreso_medio || 0, avanzado: data.progreso_avanzado || 0, lecturas_facil: data.lecturas_facil || 0, lecturas_medio: data.lecturas_medio || 0, lecturas_avanzado: data.lecturas_avanzado || 0 };
        }

        function actualizarRangoAlumno(progreso) {
            const nivelTresAlcanzado = (progreso.medio || 0) >= configuracionNivelesPalabras[1].meta ||
                (progreso.lecturas_medio || 0) >= configuracionLecturas[1].frases ||
                (progreso.avanzado || 0) > 0 || (progreso.lecturas_avanzado || 0) > 0;
            const nivelDosAlcanzado = (progreso.facil || 0) >= configuracionNivelesPalabras[0].meta ||
                (progreso.lecturas_facil || 0) >= configuracionLecturas[0].frases ||
                (progreso.medio || 0) > 0 || (progreso.lecturas_medio || 0) > 0;
            const rango = nivelTresAlcanzado ? 'Rango avanzado' : nivelDosAlcanzado ? 'Rango intermedio' : 'Rango principiante';
            document.getElementById('rango-texto').innerText = rango;
        }

        async function guardarProgresoAlumno(progreso) {
            const idAlumno = sessionStorage.getItem('id_alumno_activo');
            if (!idAlumno) return;
            const { error } = await _supabase.from('usuarios').update({
                progreso_facil: progreso.facil, progreso_medio: progreso.medio, progreso_avanzado: progreso.avanzado,
                lecturas_facil: progreso.lecturas_facil, lecturas_medio: progreso.lecturas_medio, lecturas_avanzado: progreso.lecturas_avanzado
            }).eq('id_usuario', idAlumno);
            if (error) return mostrarAlerta('No se pudo guardar el progreso: ' + escaparHTML(error.message), 'error');
            actualizarRangoAlumno(progreso);
        }

        function abrirModalCustom(titulo, placeholder, callback) {
            document.getElementById('modal-titulo').innerText = titulo;
            const input = document.getElementById('modal-input-texto');
            input.value = ''; input.placeholder = placeholder;
            document.getElementById('modal-custom').classList.remove('oculta');
            input.focus(); modalCallback = callback;
        }

        function cerrarModalCustom() { document.getElementById('modal-custom').classList.add('oculta'); modalCallback = null; }
        document.getElementById('modal-btn-confirmar').onclick = function() {
            const val = document.getElementById('modal-input-texto').value;
            const cb = modalCallback; cerrarModalCustom(); if (cb) cb(val);
        };

        function cambiarPantalla(idDestino) {
            document.querySelectorAll('.pantalla').forEach(p => { p.classList.remove('activa'); p.classList.add('oculta'); });
            document.getElementById(idDestino).classList.remove('oculta');
            document.getElementById(idDestino).classList.add('activa');
        }

        function cambiarTabLogin(rol) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('activa'));
            document.getElementById('tab-' + rol).classList.add('activa');
            document.getElementById('form-alumno').classList.add('oculta');
            document.getElementById('form-padre').classList.add('oculta');
            document.getElementById('form-docente').classList.add('oculta');
            document.getElementById('form-' + rol).classList.remove('oculta');
        }

        function alternarVisibilidadContrasenaLogin() {
            const campo = document.getElementById('docente-pass');
            const boton = document.getElementById('docente-pass-toggle');
            const mostrar = campo.type === 'password';

            campo.type = mostrar ? 'text' : 'password';
            boton.textContent = mostrar ? 'Ocultar' : 'Ver';
            boton.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
            boton.setAttribute('aria-pressed', String(mostrar));
        }
