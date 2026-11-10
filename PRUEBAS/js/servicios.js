const SUPABASE_URL = 'https://fucawnpgurwkhvdklejy.supabase.co';
        const ANON_KEY_CORRECTA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Y2F3bnBndXJ3a2h2ZGtsZWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTcyMTEsImV4cCI6MjEwODA5MzIxMX0.RvdoVCBtSJOGnijoCrO4ig6qWkO9J7_-sXHBpYDOki8';

        const { createClient } = supabase;
        const _supabase = createClient(SUPABASE_URL, ANON_KEY_CORRECTA);

        let modoClinica = false;
        let indiceClinicaActual = -1;

        let contextoAudioTono, analizadorTono, microfonoTono, idAnimacionTono;
        let frecuenciasCapturadas = [];

        async function iniciarCapturaFrecuencia() {
            frecuenciasCapturadas = [];
            contextoAudioTono = new (window.AudioContext || window.webkitAudioContext)();
            analizadorTono = contextoAudioTono.createAnalyser();
            analizadorTono.fftSize = 2048;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                microfonoTono = contextoAudioTono.createMediaStreamSource(stream);
                microfonoTono.connect(analizadorTono);
                detectarTonoProceso();
            } catch (e) { console.error("Micrófono no accesible para tono", e); }
        }

        function detectarTonoProceso() {
            if (!analizadorTono) return;
            const buffer = new Float32Array(analizadorTono.fftSize);
            analizadorTono.getFloatTimeDomainData(buffer);
            const tono = calcularAutocorrelacion(buffer, contextoAudioTono.sampleRate);
            if (tono > 80 && tono < 500) frecuenciasCapturadas.push(tono);
            idAnimacionTono = requestAnimationFrame(detectarTonoProceso);
        }

        function detenerCapturaFrecuencia() {
            if (idAnimacionTono) cancelAnimationFrame(idAnimacionTono);
            if (contextoAudioTono) contextoAudioTono.close();
            analizadorTono = null;
            if (frecuenciasCapturadas.length === 0) return 0;
            
            frecuenciasCapturadas.sort((a, b) => a - b);
            const recortes = Math.floor(frecuenciasCapturadas.length * 0.1);
            const valoresUtiles = frecuenciasCapturadas.slice(recortes, frecuenciasCapturadas.length - recortes);
            return valoresUtiles.length ? (valoresUtiles.reduce((a, b) => a + b) / valoresUtiles.length) : 0;
        }

        function calcularAutocorrelacion(buffer, sampleRate) {
            let rms = 0;
            for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
            rms = Math.sqrt(rms / buffer.length);
            if (rms < 0.01) return -1;
            let r1 = 0, r2 = buffer.length - 1, thres = 0.2;
            for (let i = 0; i < buffer.length / 2; i++) if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
            for (let i = 1; i < buffer.length / 2; i++) if (Math.abs(buffer[buffer.length - i]) < thres) { r2 = buffer.length - i; break; }
            buffer = buffer.slice(r1, r2);
            let c = new Array(buffer.length).fill(0);
            for (let i = 0; i < buffer.length; i++) for (let j = 0; j < buffer.length - i; j++) c[i] = c[i] + buffer[j] * buffer[j + i];
            let d = 0; while (c[d] > c[d + 1]) d++;
            let maxval = -1, maxpos = -1;
            for (let i = d; i < buffer.length; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
            return sampleRate / maxpos;
        }

        async function enviarCorreoRecuperacion() {
            const correo = document.getElementById('input-recuperar-correo').value.trim();
            if (!correo) return mostrarAlerta('Ingresa tu correo electrónico.', 'error');

            const { error } = await _supabase.auth.resetPasswordForEmail(correo, {
                redirectTo: window.location.origin 
            });

            if (error) return mostrarAlerta('Error: ' + error.message, 'error');

            mostrarAlerta('Te hemos enviado un enlace de recuperación. Revisa tu bandeja de entrada o SPAM.', 'exito');
            document.getElementById('input-recuperar-correo').value = '';
            cambiarPantalla('pantalla-login');
        }

        async function guardarNuevaContrasena() {
            const pass1 = document.getElementById('input-nueva-pass-1').value.trim();
            const pass2 = document.getElementById('input-nueva-pass-2').value.trim();

            if (!pass1 || !pass2) return mostrarAlerta('Llena ambos campos.', 'error');
            if (pass1 !== pass2) return mostrarAlerta('Las contraseñas no coinciden.', 'error');
            if (pass1.length < 6) return mostrarAlerta('La contraseña debe tener al menos 6 caracteres.', 'error');

            const { data: authData, error: authError } = await _supabase.auth.updateUser({ password: pass1 });
            if (authError) return mostrarAlerta('Error al actualizar: ' + authError.message, 'error');

            if (authData?.user?.email) {
                await _supabase.from('usuarios').update({ contrasena: pass1 }).eq('correo', authData.user.email);
            }

            mostrarAlerta('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión con tus nuevos datos.', 'exito');
            
            document.getElementById('input-nueva-pass-1').value = '';
            document.getElementById('input-nueva-pass-2').value = '';
            cerrarSesion();
        }

        _supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                cambiarPantalla('pantalla-nueva-pass');
            }
        });
