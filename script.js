// --- SCRIPT CON MÚSICA DE FONDO EN EL HOME ---

window.onYouTubeIframeAPIReady = function() {
    console.log("YouTube API is ready.");
    new YT.Player('background-player', {
        videoId: 'hsOOCgmjR0k',
        playerVars: { 'autoplay': 1, 'controls': 0, 'loop': 1, 'playlist': 'hsOOCgmjR0k', 'mute': 1, 'cc_load_policy': 0, 'playsinline': 1 },
        events: {
            'onReady': (event) => {
                requestCaptionsOff(event);
                event.target.playVideo();
            },
            'onApiChange': requestCaptionsOff,
            'onStateChange': (event) => {
                if (event.data === YT.PlayerState.PLAYING) requestCaptionsOff(event);
            }
        }
    });
    const appScope = window.myAppScope;
    if (appScope) {
        appScope.isApiLoaded = true;
        if (appScope.pendingVideo) {
            appScope.createPlayer(appScope.pendingVideo.id, appScope.pendingVideo.category, appScope.pendingVideo.startTime);
            delete appScope.pendingVideo;
        }
    }
};

function requestCaptionsOff(event) {
    try {
        event.target.setOption('captions', 'track', {});
    } catch (error) {
        console.warn('YouTube no permitió desactivar los subtítulos.', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos del DOM
    const backgroundMusic = document.getElementById('background-music');
    const waveBackground = document.getElementById('wave-background');
    const musicVisualizerContainer = document.getElementById('music-visualizer-container');
    const vinylRecord = document.getElementById('vinyl-record');
    const playerContainer = document.getElementById('player-container');
    const initialScreen = document.getElementById('initial-screen');
    const scannerScreen = document.getElementById('scanner-screen');
    const timesUpScreen = document.getElementById('times-up-screen');
    const countdownMessage = document.getElementById('countdown-message');
    const startScanButton = document.getElementById('start-scan-button');
    const createRoomButton = document.getElementById('create-room-button');
    const hostScreen = document.getElementById('host-screen');
    const hostHomeButton = document.getElementById('host-home-button');
    const homeButton = document.getElementById('home-button');
    const scanAgainButton = document.getElementById('scan-again-button');
    const qrStatusElement = document.getElementById('qr-reader-status');
    const starfield = document.getElementById('starfield');
    const temporalYear = document.getElementById('temporal-year');
    const warpSpeedSound = new Audio('effect.mp3');

    // --- LÓGICA PARA AUTOPLAY DE MÚSICA DE FONDO ---
    let musicUnlocked = false;
    const playPromise = backgroundMusic.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log("Música de fondo iniciada automáticamente.");
            musicUnlocked = true;
        }).catch(error => {
            console.log("Autoplay de música bloqueado. Esperando interacción.");
            document.body.addEventListener('click', unlockMusic, { once: true });
            document.body.addEventListener('touchend', unlockMusic, { once: true });
        });
    }

    function unlockMusic() {
        if (!musicUnlocked) {
            backgroundMusic.play();
            musicUnlocked = true;
            console.log("Música de fondo desbloqueada por interacción del usuario.");
            document.body.removeEventListener('click', unlockMusic);
            document.body.removeEventListener('touchend', unlockMusic);
        }
    }

    // Variables de estado
    let qrScanner, gamePlayer, preparationTimer = null, gameTimer = null, fadeStartTimer = null;
    let volumeFadeTimer = null, yearShuffleTimer = null;
    let clueStartTime = 0, clueVolume = 100;
    let travelSoundFinished = false, playerReady = false, hiddenPlaybackStarted = false;
    let playbackGeneration = 0;
    let currentGameCategory = null;
    let replacements = {};
    let lastCameraId = null;
    let isScannerRunning = false;
    let scannerStream = null;
    let scannerVideo = null;
    let scannerCanvas = null;
    let scannerContext = null;
    let scannerFrameId = null;
    let lastQrDecodeTime = 0;
    let isHandlingScan = false;
    let room = null;
    let roomPollTimer = null;
    let roomPolling = false;
    let roomBusy = false;
    const roomQueue = [];
    const queuedIds = new Set();
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

    fetch('replacements.json').then(response => response.json()).then(data => { replacements = data; console.log("Replacements loaded."); }).catch(console.error);

    window.myAppScope = { isApiLoaded: false, pendingVideo: undefined, createPlayer: createPlayer };

    function showScreen(screenElement) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screenElement.classList.add('active');
        homeButton.classList.toggle('visible', screenElement === timesUpScreen);
    }

    async function roomRequest(action, method = 'GET', body) {
        const url = `/.netlify/functions/room?action=${action}${room ? `&code=${room.code}` : ''}`;
        const response = await fetch(url, {
            method,
            headers: { ...(room ? { Authorization: `Bearer ${room.hostToken}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo conectar con la sala.');
        return data;
    }

    function showRoom() {
        showScreen(hostScreen);
        scanAgainButton.classList.remove('visible');
        document.getElementById('room-details').hidden = false;
        document.getElementById('room-code').textContent = room.code;
        const inviteUrl = new URL('guest.html', window.location.href);
        inviteUrl.search = `?room=${room.code}`;
        const link = document.getElementById('room-link');
        link.href = inviteUrl.href;
        link.title = inviteUrl.href;
        const qrTarget = document.getElementById('room-qr');
        qrTarget.innerHTML = '';
        if (window.qrcode) {
            const qr = window.qrcode(0, 'M');
            qr.addData(inviteUrl.href);
            qr.make();
            qrTarget.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true });
        }
        updateRoomStatus();
    }

    function updateRoomStatus() {
        if (!room) return;
        const count = roomQueue.length;
        document.getElementById('room-status').textContent = count
            ? `${count} tarjeta${count === 1 ? '' : 's'} en espera. La siguiente comienza al terminar la ronda.`
            : 'Esperando tarjetas de los celulares...';
    }

    async function createRoom() {
        createRoomButton.disabled = true;
        document.getElementById('room-error').textContent = '';
        try {
            room = await roomRequest('create', 'POST');
            sessionStorage.setItem('bth-room', JSON.stringify(room));
            backgroundMusic.pause();
            showRoom();
            await pollRoom();
            roomPollTimer = setInterval(pollRoom, 2000);
        } catch (error) {
            document.getElementById('room-error').textContent = error.message;
            showScreen(hostScreen);
        } finally {
            createRoomButton.disabled = false;
        }
    }

    async function pollRoom() {
        if (!room || roomPolling) return;
        roomPolling = true;
        try {
            const { events } = await roomRequest('poll');
            for (const event of events) {
                if (!queuedIds.has(event.id)) {
                    queuedIds.add(event.id);
                    roomQueue.push(event);
                }
            }
            updateRoomStatus();
            playNextRoomCard();
        } catch (error) {
            document.getElementById('room-status').textContent = error.message;
        } finally {
            roomPolling = false;
        }
    }

    async function playNextRoomCard() {
        if (!room || roomBusy || !roomQueue.length) return;
        roomBusy = true;
        const event = roomQueue.shift();
        updateRoomStatus();
        try { await roomRequest('ack', 'POST', { id: event.id }); }
        catch (error) { console.warn('No se pudo confirmar el escaneo', error); }
        let videoId = event.videoId;
        let startTime = event.startTime;
        if (replacements[videoId]) {
            videoId = replacements[videoId].videoId;
            startTime = replacements[event.videoId].startTime || null;
        }
        playVideo(videoId, event.category, startTime);
    }

    function clearExperience() {
        playbackGeneration++;
        travelSoundFinished = playerReady = hiddenPlaybackStarted = false;
        warpSpeedSound.onended = null;
        warpSpeedSound.onerror = null;
        if (volumeFadeTimer) clearInterval(volumeFadeTimer);
        if (yearShuffleTimer) clearInterval(yearShuffleTimer);
        if (fadeStartTimer) clearTimeout(fadeStartTimer);
        if (preparationTimer) clearTimeout(preparationTimer);
        if (gameTimer) clearTimeout(gameTimer);
        volumeFadeTimer = yearShuffleTimer = fadeStartTimer = preparationTimer = gameTimer = null;
        if (gamePlayer) gamePlayer.destroy();
        gamePlayer = null;
        window.myAppScope.pendingVideo = undefined;
        warpSpeedSound.pause();
        warpSpeedSound.currentTime = 0;
        document.getElementById('player').classList.remove('ready');
        countdownMessage.classList.remove('visible');
        countdownMessage.classList.remove('video-playing');
        starfield.classList.remove('visible');
        waveBackground.classList.remove('visible');
        musicVisualizerContainer.classList.remove('visible');
        vinylRecord.classList.remove('spinning');
        scanAgainButton.classList.remove('visible');
        temporalYear.textContent = '1985';
        timesUpScreen.classList.remove('year-revealed');
    }

    function returnToRoom() {
        clearExperience();
        roomBusy = false;
        showRoom();
        playNextRoomCard();
    }

    async function returnHome() {
        clearExperience();
        await stopScanner();
        if (roomPollTimer) clearInterval(roomPollTimer);
        roomPollTimer = null;
        if (room) {
            try { await roomRequest('close', 'POST'); }
            catch (error) { console.warn('No se pudo cerrar la sala', error); }
        }
        room = null;
        roomBusy = false;
        roomQueue.length = 0;
        queuedIds.clear();
        sessionStorage.removeItem('bth-room');
        showScreen(initialScreen);
        backgroundMusic.play().catch(() => {});
    }

    async function startScanning() {
        backgroundMusic.pause(); // Detener música de fondo
        clearExperience();
        currentGameCategory = null;
        isHandlingScan = false;
        showScreen(scannerScreen);
        qrStatusElement.textContent = "Buscando una tarjeta en la línea del tiempo...";
        await stopScanner();
        const qrboxSize = getScannerBoxSize();
        document.getElementById('qr-reader').style.setProperty('--scan-box-size', `${qrboxSize}px`);

        try {
            if (isFirefox && window.jsQR) {
                await startFirefoxQrScanner();
            } else {
                await startHtml5QrScanner(qrboxSize);
            }
            isScannerRunning = true;
        } catch (err) {
            console.warn("No se pudo iniciar el escáner principal; probando escáner compatible.", err);
            await stopScanner();
            try {
                await startFirefoxQrScanner();
                isScannerRunning = true;
            } catch (fallbackErr) {
                console.error("No se pudo iniciar el escáner QR", fallbackErr);
                qrStatusElement.textContent = "Error: No se pudo acceder a la cámara. Revisa los permisos del navegador o prueba con otra cámara.";
            }
        }
    }

    async function startHtml5QrScanner(qrboxSize) {
        if (!qrScanner) qrScanner = new Html5Qrcode("qr-reader");
        const config = {
            fps: 10,
            qrbox: { width: qrboxSize, height: qrboxSize }
        };
        const cameraId = await getPreferredCameraId();
        if (cameraId) {
            try {
                await qrScanner.start(cameraId, config, onScanSuccess, onScanFailure);
                return;
            } catch (err) {
                console.warn("No se pudo iniciar la cámara seleccionada; probando con facingMode.", err);
                lastCameraId = null;
            }
        }

        await qrScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure);
    }

    async function startFirefoxQrScanner() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Este navegador no expone getUserMedia.");
        }
        if (!window.jsQR) {
            throw new Error("No se cargó el lector QR compatible con Firefox.");
        }

        const qrReader = document.getElementById('qr-reader');
        qrReader.innerHTML = '';
        qrReader.classList.remove('firefox-rotate-preview');
        scannerVideo = document.createElement('video');
        scannerVideo.setAttribute('playsinline', 'true');
        scannerVideo.muted = true;
        scannerVideo.autoplay = true;
        qrReader.appendChild(scannerVideo);

        scannerCanvas = document.createElement('canvas');
        scannerCanvas.hidden = true;
        scannerContext = scannerCanvas.getContext('2d', { willReadFrequently: true });

        scannerStream = await getCameraStream();
        scannerVideo.srcObject = scannerStream;
        scannerVideo.addEventListener('loadedmetadata', updateFirefoxPreviewOrientation);
        window.addEventListener('resize', updateFirefoxPreviewOrientation);
        await scannerVideo.play();
        updateFirefoxPreviewOrientation();
        scanFirefoxFrame();
    }

    function updateFirefoxPreviewOrientation() {
        if (!scannerVideo) return;

        const qrReader = document.getElementById('qr-reader');
        const isPortraitViewport = window.innerHeight > window.innerWidth;
        const isLandscapeFrame = scannerVideo.videoWidth > scannerVideo.videoHeight;
        qrReader.classList.toggle('firefox-rotate-preview', isPortraitViewport && isLandscapeFrame);
    }

    async function getCameraStream() {
        const cameraId = await getPreferredCameraId();
        const constraintAttempts = [];
        if (cameraId) {
            constraintAttempts.push({ video: { deviceId: { exact: cameraId } } });
        }
        constraintAttempts.push({ video: { facingMode: { ideal: 'environment' } } });
        constraintAttempts.push({ video: true });

        let lastError = null;
        for (const constraints of constraintAttempts) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack && videoTrack.getSettings().deviceId) {
                    lastCameraId = videoTrack.getSettings().deviceId;
                }
                return stream;
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error("No se encontró una cámara disponible.");
    }

    function scanFirefoxFrame() {
        if (!scannerVideo || !scannerContext || isHandlingScan) return;

        const now = performance.now();
        if (now - lastQrDecodeTime >= 120 && scannerVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && scannerVideo.videoWidth && scannerVideo.videoHeight) {
            lastQrDecodeTime = now;
            const decodedText = decodeVideoFrame(scannerVideo.videoWidth, scannerVideo.videoHeight);
            if (decodedText) {
                onScanSuccess(decodedText);
                return;
            }
        }

        scannerFrameId = requestAnimationFrame(scanFirefoxFrame);
    }

    function decodeVideoFrame(videoWidth, videoHeight) {
        const rotations = [0, 90, 180, 270];
        for (const rotation of rotations) {
            const result = decodeVideoFrameRotation(videoWidth, videoHeight, rotation);
            if (result) return result;
        }
        return null;
    }

    function decodeVideoFrameRotation(videoWidth, videoHeight, rotation) {
        const rotated = rotation === 90 || rotation === 270;
        scannerCanvas.width = rotated ? videoHeight : videoWidth;
        scannerCanvas.height = rotated ? videoWidth : videoHeight;
        scannerContext.save();
        scannerContext.clearRect(0, 0, scannerCanvas.width, scannerCanvas.height);
        if (rotation === 90) {
            scannerContext.translate(scannerCanvas.width, 0);
            scannerContext.rotate(Math.PI / 2);
        } else if (rotation === 180) {
            scannerContext.translate(scannerCanvas.width, scannerCanvas.height);
            scannerContext.rotate(Math.PI);
        } else if (rotation === 270) {
            scannerContext.translate(0, scannerCanvas.height);
            scannerContext.rotate(-Math.PI / 2);
        }
        scannerContext.drawImage(scannerVideo, 0, 0, videoWidth, videoHeight);
        scannerContext.restore();

        const imageData = scannerContext.getImageData(0, 0, scannerCanvas.width, scannerCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        return code ? code.data : null;
    }

    async function getPreferredCameraId() {
        if (lastCameraId) return lastCameraId;

        try {
            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) return null;

            const environmentCamera = cameras.find(camera => {
                const label = (camera.label || '').toLowerCase();
                return label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('trasera');
            });
            lastCameraId = (environmentCamera || cameras[0]).id;
            return lastCameraId;
        } catch (err) {
            console.warn("No se pudo enumerar cámaras; se usará facingMode.", err);
            return null;
        }
    }

    async function stopScanner() {
        if (scannerFrameId) {
            cancelAnimationFrame(scannerFrameId);
            scannerFrameId = null;
        }
        if (scannerStream) {
            scannerStream.getTracks().forEach(track => track.stop());
            scannerStream = null;
        }
        if (scannerVideo) {
            scannerVideo.removeEventListener('loadedmetadata', updateFirefoxPreviewOrientation);
            window.removeEventListener('resize', updateFirefoxPreviewOrientation);
            document.getElementById('qr-reader').classList.remove('firefox-rotate-preview');
            scannerVideo.srcObject = null;
            scannerVideo.remove();
            scannerVideo = null;
        }
        scannerCanvas = null;
        scannerContext = null;
        lastQrDecodeTime = 0;

        if (qrScanner && isScannerRunning) {
            try {
                await qrScanner.stop();
            } catch (err) {
                console.warn("No se pudo detener el escáner QR", err);
            }
        }
        isScannerRunning = false;
    }

    function onScanFailure() {
        // html5-qrcode llama esta función continuamente cuando no detecta códigos.
        // La dejamos silenciosa para no llenar la consola ni parpadear el estado.
    }

    function getScannerBoxSize() {
        const reader = document.getElementById('qr-reader');
        const readerSize = reader.clientWidth || Math.min(window.innerWidth, window.innerHeight);
        return Math.max(40, Math.min(Math.round(readerSize * 0.72), readerSize - 12, 360));
    }

    async function onScanSuccess(decodedText) {
        if (isHandlingScan) return;
        isHandlingScan = true;
        qrStatusElement.textContent = "QR detectado. Preparando viaje temporal...";
        await stopScanner();
        try {
            const params = getQrParams(decodedText);
            let videoId = null, detectedCategory = null;
            let startTime = params.get('s');
            if (params.has('c')) { detectedCategory = 'cine'; videoId = params.get('c'); }
            else if (params.has('g')) { detectedCategory = 'juego'; videoId = params.get('g'); }
            else if (params.has('mv')) { detectedCategory = 'musica_video'; videoId = params.get('mv'); }
            else if (params.has('ma')) { detectedCategory = 'musica_audio'; videoId = params.get('ma'); }
            if (videoId && videoId.length > 5) {
                if (replacements[videoId]) {
                    const r = replacements[videoId];
                    videoId = r.videoId;
                    startTime = r.startTime || null;
                }
                playVideo(videoId, detectedCategory, startTime);
            } else { throw new Error("Formato QR no reconocido."); }
        } catch (error) {
            isHandlingScan = false;
            qrStatusElement.textContent = "Código QR no válido. Inténtalo de nuevo.";
            setTimeout(() => startScanning(), 2000);
        }
    }

    function getQrParams(decodedText) {
        const trimmedText = decodedText.trim();
        try {
            return new URL(trimmedText, window.location.href).searchParams;
        } catch (error) {
            const queryString = trimmedText.startsWith('?') ? trimmedText.slice(1) : trimmedText;
            return new URLSearchParams(queryString);
        }
    }

    function playVideo(videoId, videoCategory, startTime) {
        const generation = ++playbackGeneration;
        travelSoundFinished = playerReady = hiddenPlaybackStarted = false;
        countdownMessage.classList.add('visible');
        countdownMessage.classList.remove('video-playing');
        starfield.classList.add('visible');
        document.getElementById('player').classList.remove('ready');
        showScreen(playerContainer);
        scanAgainButton.classList.add('visible');
        warpSpeedSound.currentTime = 0;
        const finishSound = () => {
            if (generation !== playbackGeneration || travelSoundFinished) return;
            travelSoundFinished = true;
            startHiddenPlayback();
        };
        warpSpeedSound.onended = finishSound;
        warpSpeedSound.onerror = finishSound;
        if (window.myAppScope.isApiLoaded) {
            createPlayer(videoId, videoCategory, startTime);
        } else {
            window.myAppScope.pendingVideo = { id: videoId, category: videoCategory, startTime: startTime };
        }
        try {
            const soundPromise = warpSpeedSound.play();
            if (soundPromise && typeof soundPromise.catch === 'function') soundPromise.catch(finishSound);
        } catch (error) { finishSound(); }
    }

    function loadYouTubeAPIScript(){
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    function createPlayer(videoId, videoCategory, startTime) {
        if (gamePlayer) gamePlayer.destroy();
        gamePlayer = null;
        currentGameCategory = videoCategory;
        const playerVars = { 'autoplay': 0, 'mute': 0, 'controls': 0, 'rel': 0, 'cc_load_policy': 0, 'playsinline': 1 };
        clueStartTime = startTime ? parseInt(startTime, 10) : 0;
        if (clueStartTime) playerVars.start = clueStartTime;
        gamePlayer = new YT.Player('player', {
            videoId: videoId,
            playerVars: playerVars,
            events: { 'onReady': onGamePlayerReady, 'onApiChange': requestCaptionsOff, 'onStateChange': onPlayerStateChange }
        });
    }

    window.myAppScope.createPlayer = createPlayer;
    window.myAppScope.playVideo = playVideo;

    function onGamePlayerReady(event) {
        if (event.target !== gamePlayer) return;
        requestCaptionsOff(event);
        clueVolume = event.target.getVolume();
        event.target.setVolume(0);
        playerReady = true;
        startHiddenPlayback();
    }

    function startHiddenPlayback() {
        if (!travelSoundFinished || !playerReady || !gamePlayer || hiddenPlaybackStarted) return;
        hiddenPlaybackStarted = true;
        gamePlayer.setVolume(clueVolume);
        gamePlayer.playVideo();
    }

    function onPlayerStateChange(event) {
        if (event.target !== gamePlayer) return;
        if (event.data === YT.PlayerState.PLAYING) {
            requestCaptionsOff(event);
        }
        if (event.data === YT.PlayerState.PLAYING && hiddenPlaybackStarted && preparationTimer === null) {
            countdownMessage.classList.add('video-playing');
            preparationTimer = setTimeout(() => {
                const playerElement = document.getElementById('player');
                countdownMessage.classList.remove('visible');
                starfield.classList.remove('visible');
                if (currentGameCategory === 'musica_audio') {
                    waveBackground.classList.add('visible');
                    musicVisualizerContainer.classList.add('visible');
                    vinylRecord.classList.add('spinning');
                } else {
                    if (playerElement) playerElement.classList.add('ready');
                }
            }, 7000);
            fadeStartTimer = setTimeout(fadeOutGamePlayer, 67000);
            gameTimer = setTimeout(endGame, 70000);
        }
    }

    function endGame(){
        if (fadeStartTimer) clearTimeout(fadeStartTimer);
        if (volumeFadeTimer) clearInterval(volumeFadeTimer);
        fadeStartTimer = null;
        volumeFadeTimer = null;
        if (gamePlayer) {
            gamePlayer.setVolume(0);
            gamePlayer.pauseVideo();
        }
        const playerElement = document.getElementById('player');
        if (playerElement) playerElement.classList.remove('ready');
        warpSpeedSound.pause();
        warpSpeedSound.currentTime = 0;
        waveBackground.classList.remove('visible');
        musicVisualizerContainer.classList.remove('visible');
        vinylRecord.classList.remove('spinning');
        showScreen(timesUpScreen);
        shuffleTemporalYear();
        fadeOutGamePlayer();
    }

    function shuffleTemporalYear() {
        let frame = 0;
        const years = [1955, 1985, 2015, 1885, 2026];
        timesUpScreen.classList.remove('year-revealed');
        temporalYear.textContent = String(years[0]);
        yearShuffleTimer = setInterval(() => {
            frame += 1;
            if (frame >= 50) {
                temporalYear.textContent = '????';
                timesUpScreen.classList.add('year-revealed');
                clearInterval(yearShuffleTimer);
                yearShuffleTimer = null;
            } else {
                temporalYear.textContent = String(years[frame % years.length]);
            }
        }, 100);
    }

    function fadeOutGamePlayer() {
        if (!gamePlayer || typeof gamePlayer.getVolume !== 'function') return;
        const player = gamePlayer;
        const startVolume = player.getVolume();
        let step = 0;
        volumeFadeTimer = setInterval(() => {
            step += 1;
            player.setVolume(Math.max(0, Math.round(startVolume * (1 - step / 40))));
            if (step >= 40) {
                clearInterval(volumeFadeTimer);
                volumeFadeTimer = null;
                player.pauseVideo();
            }
        }, 75);
    }

    startScanButton.addEventListener('click', startScanning);
    createRoomButton.addEventListener('click', createRoom);
    scanAgainButton.addEventListener('click', () => room ? returnToRoom() : startScanning());
    homeButton.addEventListener('click', returnHome);
    hostHomeButton.addEventListener('click', returnHome);
    try {
        const savedRoom = JSON.parse(sessionStorage.getItem('bth-room') || 'null');
        if (savedRoom && savedRoom.expiresAt > Date.now()) {
            room = savedRoom;
            backgroundMusic.pause();
            showRoom();
            pollRoom();
            roomPollTimer = setInterval(pollRoom, 2000);
        }
    } catch (error) { sessionStorage.removeItem('bth-room'); }
    loadYouTubeAPIScript();
    const urlParams = new URLSearchParams(window.location.search);
    const isDevMode = urlParams.get('dev') === 'true';
    if ('serviceWorker' in navigator && !isDevMode) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(reg => console.log('SW Registrado')).catch(err => console.log('Error SW', err));
        });
    } else { console.log('MODO DESARROLLO'); }
});
