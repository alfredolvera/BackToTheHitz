(() => {
    const form = document.getElementById('join-form');
    const input = document.getElementById('guest-room-code');
    const connected = document.getElementById('guest-connected');
    const status = document.getElementById('guest-status');
    const error = document.getElementById('guest-error');
    const scanAgain = document.getElementById('guest-scan-again');
    const leave = document.getElementById('guest-leave');
    const reader = document.getElementById('qr-reader');
    let code = null;
    let scanner = null;
    let stream = null;
    let frameId = null;
    let handling = false;

    async function api(action, method = 'GET', body) {
        const response = await fetch(`/.netlify/functions/room?action=${action}&code=${encodeURIComponent(code)}`, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {},
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo conectar con la sala.');
        return data;
    }

    async function stopCamera() {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = null;
        if (stream) stream.getTracks().forEach(track => track.stop());
        stream = null;
        if (scanner) {
            try { await scanner.stop(); } catch (_) { /* La cámara ya puede estar detenida. */ }
            scanner = null;
        }
        reader.innerHTML = '';
    }

    async function submitScan(qr) {
        if (handling) return;
        handling = true;
        status.textContent = 'Enviando tarjeta al host...';
        await stopCamera();
        try {
            await api('submit', 'POST', { qr });
            status.textContent = '¡Tarjeta enviada! La pantalla principal la reproducirá cuando le toque.';
            scanAgain.hidden = false;
        } catch (err) {
            status.textContent = err.message;
            scanAgain.hidden = false;
        }
    }

    async function startFallbackCamera() {
        if (!navigator.mediaDevices?.getUserMedia || !window.jsQR) throw new Error('No se pudo abrir la cámara en este navegador.');
        const video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.autoplay = true;
        reader.appendChild(video);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        video.srcObject = stream;
        await video.play();
        function scanFrame() {
            if (!stream || handling) return;
            if (video.videoWidth && video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0);
                const image = context.getImageData(0, 0, canvas.width, canvas.height);
                const result = window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
                if (result) { submitScan(result.data); return; }
            }
            frameId = requestAnimationFrame(scanFrame);
        }
        scanFrame();
    }

    async function startCamera() {
        await stopCamera();
        handling = false;
        scanAgain.hidden = true;
        status.textContent = 'Apunta la cámara a una tarjeta.';
        try {
            scanner = new Html5Qrcode('qr-reader');
            await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: (width, height) => {
                const size = Math.max(80, Math.min(width, height) - 32);
                return { width: size, height: size };
            } }, submitScan, () => {});
        } catch (err) {
            console.warn('Probando lector alternativo', err);
            await stopCamera();
            try { await startFallbackCamera(); }
            catch (fallbackError) { status.textContent = fallbackError.message; scanAgain.hidden = false; }
        }
    }

    async function joinRoom(event) {
        event.preventDefault();
        error.textContent = '';
        code = input.value.trim().toUpperCase().replace(/\s/g, '');
        input.value = code;
        try {
            await api('join');
            history.replaceState(null, '', `guest.html?room=${code}`);
            form.hidden = true;
            connected.hidden = false;
            document.getElementById('guest-room-label').textContent = code;
            await startCamera();
        } catch (err) {
            error.textContent = err.message;
            code = null;
        }
    }

    form.addEventListener('submit', joinRoom);
    scanAgain.addEventListener('click', startCamera);
    leave.addEventListener('click', async () => {
        await stopCamera();
        connected.hidden = true;
        form.hidden = false;
        code = null;
        history.replaceState(null, '', 'guest.html');
    });
    const inviteCode = new URLSearchParams(location.search).get('room');
    if (inviteCode) {
        input.value = inviteCode;
        form.requestSubmit();
    }
})();
