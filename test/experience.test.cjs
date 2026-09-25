const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadApp(options = {}) {
    const elements = new Map();
    const timers = new Map();
    const intervals = new Map();
    const players = [];
    const scans = [];
    const audios = [];
    let nextTimer = 1;

    function element(id) {
        if (!elements.has(id)) {
            const classes = new Set(id === 'initial-screen' ? ['screen', 'active'] : ['screen']);
            elements.set(id, {
                id,
                classList: {
                    add: name => classes.add(name),
                    remove: name => classes.delete(name),
                    contains: name => classes.has(name),
                    toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }
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
            this.captionOptions = [];
            this.seeks = [];
            this.playCount = 0;
            this.muted = false;
            players.push(this);
        }
        getVolume() { return this.volume; }
        setVolume(value) { this.volume = value; }
        setOption(module, option, value) { this.captionOptions.push({ module, option, value }); }
        seekTo(time, allowSeekAhead) { this.seeks.push({ time, allowSeekAhead }); }
        pauseVideo() { this.paused = true; }
        playVideo() { this.playCount++; }
        mute() { this.muted = true; }
        unMute() { this.muted = false; }
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
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        navigator: { userAgent: 'Chrome' },
        Audio: class { constructor() { audios.push(this); } play() { this.playCount = (this.playCount || 0) + 1; return Promise.resolve(); } pause() {}; currentTime = 0; },
        YT: { Player, PlayerState: { PLAYING: 1 } }, Html5Qrcode,
        fetch: options.fetch || (() => Promise.resolve({ json: () => Promise.resolve({}) })),
        setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        setInterval(callback, delay) { const id = nextTimer++; intervals.set(id, { callback, delay }); return id; },
        clearInterval(id) { intervals.delete(id); },
        URL, URLSearchParams, console
    };
    vm.runInNewContext(fs.readFileSync('script.js', 'utf8'), context);
    window.onYouTubeIframeAPIReady();
    return { window, element, players, timers, intervals, scans, audios };
}

function startRound(app, startTime = null) {
    app.window.myAppScope.playVideo('abcdefghijk', 'cine', startTime);
    const player = app.players[1];
    player.options.events.onReady({ target: player });
    app.audios[0].onended();
    player.options.events.onStateChange({ data: 1, target: player });
    return player;
}

test('YouTube players request captions off on load and when caption options become available', () => {
    const app = loadApp();
    app.window.myAppScope.createPlayer('video-id', 'cine', null);
    assert.equal(app.players.length, 2);
    for (const player of app.players) {
        assert.equal(player.options.playerVars.cc_load_policy, 0);
        player.options.events.onReady({ target: player });
        player.options.events.onApiChange({ target: player });
        assert.equal(player.captionOptions.length, 2);
        assert.equal(player.captionOptions[0].module, 'captions');
        assert.equal(player.captionOptions[0].option, 'track');
        assert.equal(Object.keys(player.captionOptions[0].value).length, 0);
    }
});

test('the video runs for 70 seconds including its hidden prelude and fades audio during the last 3', () => {
    const app = loadApp();
    const player = startRound(app);
    const preparation = [...app.timers.values()].find(timer => timer.delay === 7000);
    preparation.callback();
    const fade = [...app.timers.values()].find(timer => timer.delay === 67000);
    const game = [...app.timers.values()].find(timer => timer.delay === 70000);
    assert.ok(fade);
    assert.ok(game);
    assert.equal(app.element('times-up-screen').classList.contains('active'), false);
    fade.callback();
    assert.equal(player.volume, 80);
    assert.equal(player.paused, false);
    const volumeInterval = [...app.intervals.values()].find(interval => interval.delay === 75);
    assert.ok(volumeInterval);
    for (let step = 0; step < 39; step++) {
        volumeInterval.callback();
    }
    assert.ok(player.volume > 0);
    assert.equal(player.paused, false);
    volumeInterval.callback();
    game.callback();
    assert.equal(app.element('times-up-screen').classList.contains('active'), true);
    assert.equal(player.volume, 0);
    assert.equal(player.paused, true);
});

test('the video starts audibly after the travel sound and stays hidden for seven seconds', () => {
    const app = loadApp();
    app.window.myAppScope.playVideo('abcdefghijk', 'cine', '42');
    const player = app.players[1];
    player.options.events.onReady({ target: player });
    assert.equal(player.volume, 0);
    assert.equal(player.playCount, 0);
    assert.equal(player.options.playerVars.start, 42);
    assert.equal(player.options.playerVars.controls, 0);
    assert.equal(app.element('player').classList.contains('ready'), false);
    app.audios[0].onended();
    assert.equal(player.volume, 80);
    assert.equal(player.playCount, 1);
    assert.equal(app.element('player').classList.contains('ready'), false);
    assert.equal(app.element('countdown-message').classList.contains('video-playing'), false);
    player.options.events.onStateChange({ data: 1, target: player });
    assert.equal(app.element('countdown-message').classList.contains('video-playing'), true);
    [...app.timers.values()].find(timer => timer.delay === 7000).callback();
    assert.deepEqual(player.seeks, []);
    assert.equal(player.volume, 80);
    assert.equal(app.element('player').classList.contains('ready'), true);
    assert.equal(app.element('countdown-message').classList.contains('visible'), false);
});

test('the YouTube player is prepared but does not play until the travel sound finishes', async () => {
    const app = loadApp();
    app.window.myAppScope.playVideo('abcdefghijk', 'cine', '42');
    assert.equal(app.audios[0].playCount, 1);
    assert.equal(app.players.length, 2);
    const player = app.players[1];
    player.options.events.onReady({ target: player });
    assert.equal(player.playCount, 0);
    assert.equal([...app.timers.values()].some(timer => timer.delay === 7000), false);
    assert.equal(app.element('countdown-message').classList.contains('visible'), true);
    app.audios[0].onended();
    assert.equal(player.playCount, 1);
    assert.equal(app.element('player').classList.contains('ready'), false);
    assert.equal([...app.timers.values()].some(timer => timer.delay === 7000), false);
});

test('if the travel sound ends while YouTube loads, playback starts when the player is ready', () => {
    const app = loadApp();
    app.window.myAppScope.playVideo('abcdefghijk', 'cine', null);
    const player = app.players[1];
    app.audios[0].onended();
    assert.equal(player.playCount, 0);
    player.options.events.onReady({ target: player });
    assert.equal(player.playCount, 1);
    assert.equal(player.volume, 80);
});

test('the temporal year display keeps shuffling for 5 seconds', () => {
    const app = loadApp();
    startRound(app);
    [...app.timers.values()].find(timer => timer.delay === 7000).callback();
    [...app.timers.values()].find(timer => timer.delay === 70000).callback();
    const yearInterval = [...app.intervals.values()].find(interval => interval.delay === 100);
    assert.ok(yearInterval);
    for (let step = 0; step < 49; step++) yearInterval.callback();
    assert.notEqual(app.element('temporal-year').textContent, '????');
    yearInterval.callback();
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

test('the left-side results button returns to the home screen', async () => {
    const app = loadApp();
    startRound(app);
    [...app.timers.values()].find(timer => timer.delay === 7000).callback();
    [...app.timers.values()].find(timer => timer.delay === 70000).callback();
    assert.equal(app.element('home-button').classList.contains('visible'), true);
    await app.element('home-button').click();
    assert.equal(app.element('initial-screen').classList.contains('active'), true);
    assert.equal(app.element('home-button').classList.contains('visible'), false);
});

test('a host room plays a submitted card and returns to the room without opening its camera', async () => {
    let events = [{ id: '0000000001000-0123456789abcdef', videoId: 'abcdefghijk', category: 'cine', startTime: '12' }];
    const fetch = async url => {
        const action = new URL(url, 'https://example.test').searchParams.get('action');
        const data = action === 'create' ? { code: 'ABCDEFG', hostToken: 'a'.repeat(64), expiresAt: Date.now() + 100000 }
            : action === 'poll' ? { events } : { ok: true };
        if (action === 'ack') events = [];
        return { ok: true, json: async () => data };
    };
    const app = loadApp({ fetch });
    await app.element('create-room-button').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.element('player-container').classList.contains('active'), true);
    assert.equal(app.players[1].options.videoId, 'abcdefghijk');
    await app.element('scan-again-button').click();
    assert.equal(app.element('host-screen').classList.contains('active'), true);
    assert.equal(app.scans.length, 0);
});
