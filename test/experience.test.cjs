const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadApp() {
    const elements = new Map();
    const timers = new Map();
    const intervals = new Map();
    const players = [];
    const scans = [];
    let nextTimer = 1;

    function element(id) {
        if (!elements.has(id)) {
            const classes = new Set(id === 'initial-screen' ? ['screen', 'active'] : ['screen']);
            elements.set(id, {
                id,
                classList: {
                    add: name => classes.add(name),
                    remove: name => classes.delete(name),
                    contains: name => classes.has(name)
                },
                style: { setProperty() {} },
                addEventListener(name, callback) { this[name] = callback; },
                removeEventListener() {},
                appendChild() {},
                setAttribute() {},
                play() { return Promise.resolve(); },
                pause() {},
                textContent: ''
            });
        }
        return elements.get(id);
    }

    const document = {
        getElementById: element,
        querySelectorAll: () => ['initial-screen', 'scanner-screen', 'player-container', 'times-up-screen'].map(element),
        addEventListener(name, callback) { if (name === 'DOMContentLoaded') callback(); },
        createElement: () => ({ setAttribute() {} }),
        getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }],
        body: { addEventListener() {}, removeEventListener() {} }
    };
    class Player {
        constructor(id, options) {
            this.id = id;
            this.options = options;
            this.volume = 80;
            this.paused = false;
            players.push(this);
        }
        getVolume() { return this.volume; }
        setVolume(value) { this.volume = value; }
        pauseVideo() { this.paused = true; }
        playVideo() {}
        destroy() {}
    }
    class Html5Qrcode {
        static async getCameras() { return [{ id: 'camera-1', label: 'Back Camera' }]; }
        async start(camera, config) { scans.push(config); }
        async stop() {}
    }
    const window = { location: { search: '', href: 'https://example.test/' }, innerWidth: 812, innerHeight: 375, addEventListener() {} };
    const context = {
        window, document,
        navigator: { userAgent: 'Chrome' },
        Audio: class { play() {}; pause() {}; currentTime = 0; },
        YT: { Player, PlayerState: { PLAYING: 1 } }, Html5Qrcode,
        fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
        setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        setInterval(callback, delay) { const id = nextTimer++; intervals.set(id, { callback, delay }); return id; },
        clearInterval(id) { intervals.delete(id); },
        URL, URLSearchParams, console
    };
    vm.runInNewContext(fs.readFileSync('script.js', 'utf8'), context);
    window.onYouTubeIframeAPIReady();
    return { window, element, players, timers, intervals, scans };
}

test('YouTube players request captions off by default', () => {
    const app = loadApp();
    app.window.myAppScope.createPlayer('video-id', 'cine', null);
    assert.equal(app.players.length, 2);
    for (const player of app.players) {
        assert.equal(player.options.playerVars.cc_load_policy, 0);
    }
});

test('the guessing screen fades video audio and then pauses playback', () => {
    const app = loadApp();
    app.window.myAppScope.createPlayer('video-id', 'cine', null);
    const player = app.players[1];
    player.options.events.onStateChange({ data: 1 });
    const preparation = [...app.timers.values()].find(timer => timer.delay === 7000);
    preparation.callback();
    const game = [...app.timers.values()].find(timer => timer.delay === 60000);
    game.callback();

    assert.equal(app.element('times-up-screen').classList.contains('active'), true);
    assert.equal(player.volume, 80);
    assert.equal(player.paused, false);
    assert.ok(app.intervals.size >= 1);
    for (let step = 0; step < 40 && !player.paused; step++) {
        for (const interval of [...app.intervals.values()]) interval.callback();
    }
    assert.equal(player.volume, 0);
    assert.equal(player.paused, true);
});

test('the temporal year display settles on an unknown year when guessing begins', () => {
    const app = loadApp();
    app.window.myAppScope.createPlayer('video-id', 'cine', null);
    app.players[1].options.events.onStateChange({ data: 1 });
    [...app.timers.values()].find(timer => timer.delay === 7000).callback();
    [...app.timers.values()].find(timer => timer.delay === 60000).callback();
    for (let step = 0; step < 50 && app.element('temporal-year').textContent !== '????'; step++) {
        for (const interval of [...app.intervals.values()]) interval.callback();
    }
    assert.equal(app.element('temporal-year').textContent, '????');
});

test('the QR scan box fits inside the visible camera preview on a short widescreen display', async () => {
    const app = loadApp();
    app.element('qr-reader').clientWidth = 165;
    await app.element('start-scan-button').click();
    assert.equal(app.scans.length, 1);
    assert.ok(app.scans[0].qrbox.width <= 165);
    assert.ok(app.scans[0].qrbox.height <= 165);
});
