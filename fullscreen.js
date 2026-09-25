(() => {
    const button = document.getElementById('fullscreen-toggle');
    if (!button) return;

    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (typeof request !== 'function' || typeof exit !== 'function' || document.fullscreenEnabled === false) {
        button.hidden = true;
        return;
    }

    const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    const update = () => {
        const active = isFullscreen();
        const label = active ? 'Salir de pantalla completa' : 'Activar pantalla completa';
        button.classList.toggle('is-fullscreen', active);
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute('aria-label', label);
        button.title = label;
    };

    button.addEventListener('click', () => {
        try {
            const result = isFullscreen() ? exit.call(document) : request.call(root);
            if (result && typeof result.catch === 'function') {
                result.catch(error => console.warn('No se pudo cambiar a pantalla completa:', error));
            }
        } catch (error) {
            console.warn('No se pudo cambiar a pantalla completa:', error);
        }
    });
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    update();
})();
