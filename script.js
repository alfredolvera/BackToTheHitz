// --- SCRIPT CON MÚSICA DE FONDO EN EL HOME ---

window.onYouTubeIframeAPIReady = function() {
    console.log("YouTube API is ready.");
    new YT.Player('background-player', {
        videoId: 'hsOOCgmjR0k',
        playerVars: { 'autoplay': 1, 'controls': 0, 'loop': 1, 'playlist': 'hsOOCgmjR0k', 'mute': 1, 'showinfo': 0, 'modestbranding': 1, 'playsinline': 1 },
        events: { 'onReady': (event) => event.target.playVideo() }
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
    const scanAgainButton = document.getElementById('scan-again-button');
    const qrStatusElement = document.getElementById('qr-reader-status');
    const starfield = document.getElementById('starfield');
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
    let qrScanner, gamePlayer, preparationTimer = null, gameTimer = null;
    let currentGameCategory = null;
    let replacements = {};
    let lastCameraId = null;
    let isScannerRunning = false;

    fetch('replacements.json').then(response => response.json()).then(data => { replacements = data; console.log("Replacements loaded."); }).catch(console.error);

    window.myAppScope = { isApiLoaded: false, pendingVideo: undefined, createPlayer: createPlayer };

    function showScreen(screenElement) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screenElement.classList.add('active');
    }

    async function startScanning() {
        backgroundMusic.pause(); // Detener música de fondo
        if (gamePlayer) gamePlayer.destroy();
        if (preparationTimer) clearTimeout(preparationTimer);
        if (gameTimer) clearTimeout(gameTimer);
        warpSpeedSound.pause();
        warpSpeedSound.currentTime = 0;
        gamePlayer = null; preparationTimer = null; gameTimer = null;
        currentGameCategory = null;
        document.getElementById('player').classList.remove('ready');
        countdownMessage.classList.remove('visible');
        starfield.classList.remove('visible');
        waveBackground.classList.remove('visible');
        musicVisualizerContainer.classList.remove('visible');
        vinylRecord.classList.remove('spinning');
        scanAgainButton.classList.remove('visible');
        showScreen(scannerScreen);
        qrStatusElement.textContent = "Buscando una tarjeta en la línea del tiempo...";
        if (!qrScanner) qrScanner = new Html5Qrcode("qr-reader");
        if (isScannerRunning) await stopScanner();
        const qrboxSize = getScannerBoxSize();
        document.getElementById('qr-reader').style.setProperty('--scan-box-size', `${qrboxSize}px`);
        const config = {
            fps: 10,
            qrbox: { width: qrboxSize, height: qrboxSize }
        };

        try {
            await startScannerWithBestCamera(config);
            isScannerRunning = true;
        } catch (err) {
            console.error("No se pudo iniciar el escáner QR", err);
            qrStatusElement.textContent = "Error: No se pudo acceder a la cámara. Revisa los permisos del navegador o prueba con otra cámara.";
        }
    }


    async function startScannerWithBestCamera(config) {
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
        if (!qrScanner || !isScannerRunning) return;

        try {
            await qrScanner.stop();
        } catch (err) {
            console.warn("No se pudo detener el escáner QR", err);
        } finally {
            isScannerRunning = false;
        }
    }

    function onScanFailure() {
        // html5-qrcode llama esta función continuamente cuando no detecta códigos.
        // La dejamos silenciosa para no llenar la consola ni parpadear el estado.
    }

    function getScannerBoxSize() {
        const shortestViewportSide = Math.min(window.innerWidth, window.innerHeight);
        const comfortableSize = Math.round(shortestViewportSide * 0.68);
        return Math.max(220, Math.min(comfortableSize, 360));
    }

    async function onScanSuccess(decodedText) {
        qrStatusElement.textContent = "QR detectado. Preparando viaje temporal...";
        await stopScanner();
        try {
            const params = new URLSearchParams(decodedText);
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
            qrStatusElement.textContent = "Código QR no válido. Inténtalo de nuevo.";
            setTimeout(() => startScanning(), 2000);
        }
    }

    function playVideo(videoId, videoCategory, startTime) {
        showScreen(playerContainer);
        scanAgainButton.classList.add('visible');
        if (window.myAppScope.isApiLoaded) {
            createPlayer(videoId, videoCategory, startTime);
        } else {
            window.myAppScope.pendingVideo = { id: videoId, category: videoCategory, startTime: startTime };
        }
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
        countdownMessage.classList.add('visible');
        starfield.classList.add('visible');
        warpSpeedSound.play();
        const playerVars = { 'autoplay': 1, 'mute': 0, 'controls': 1, 'rel': 0 };
        if (startTime) playerVars.start = parseInt(startTime, 10);
        gamePlayer = new YT.Player('player', { videoId: videoId, playerVars: playerVars, events: { 'onStateChange': onPlayerStateChange } });
    }

    window.myAppScope.createPlayer = createPlayer;

    function onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING && preparationTimer === null) {
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
                gameTimer = setTimeout(endGame, 60000);
            }, 7000);
        }
    }

    function endGame(){
        const playerElement = document.getElementById('player');
        if (playerElement) playerElement.classList.remove('ready');
        warpSpeedSound.pause();
        warpSpeedSound.currentTime = 0;
        waveBackground.classList.remove('visible');
        musicVisualizerContainer.classList.remove('visible');
        vinylRecord.classList.remove('spinning');
        showScreen(timesUpScreen);
    }

    startScanButton.addEventListener('click', startScanning);
    scanAgainButton.addEventListener('click', startScanning);
    loadYouTubeAPIScript();
    const urlParams = new URLSearchParams(window.location.search);
    const isDevMode = urlParams.get('dev') === 'true';
    if ('serviceWorker' in navigator && !isDevMode) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(reg => console.log('SW Registrado')).catch(err => console.log('Error SW', err));
        });
    } else { console.log('MODO DESARROLLO'); }
});