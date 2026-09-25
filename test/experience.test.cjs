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
            this.captionOptions = [];
            this.seeks = [];
            players.push(this);
        }
        getVolume() { return this.volume; }
        setVolume(value) { this.volume = value; }
        setOption(module, option, value) { this.captionOptions.push({ module, option, value }); }
        seekTo(time, allowSeekAhead) { this.seeks.push({ time, allowSeekAhead }); }
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

test('the 60-second experience shows the clue for 53 seconds and fades audio during its last 3 seconds', () => {
    const app = loadApp();
    app.window.myAppScope.createPlayer('video-id', 'cine', null);
    const player = app.players[1];
    player.options.events.onReady({ target: player });
    player.options.events.onStateChange({ data: 1, target: player });
    const preparation = [...app.timers.values()].find(timer => timer.delay === 7000);
    preparation.callback();
    const fade = [...app.timers.values()].find(timer => timer.delay === 50000);
    const game = [...app.timers.values()].find(timer => timer.delay === 53000);
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

test('the seven-second introduction stays silent and the clue starts at the card timestamp', () => {
    const app = loadApp();
    app.window.myAppScope.createPlayer('video-id', 'cine', '42');
    const player = app.players[1];
    player.options.events.onReady({ target: player });
    assert.equal(player.volume, 0);
    player.options.events.onStateChange({ data: 1, target: player });
    assert.equal(player.volume, 0);
    [...app.timers.values()].find(timer => timer.delay === 7000).callback();
    assert.deepEqual(player.seeks, [{ time: 42, allowSeekAhead: true }]);
    assert.equal(player.volume, 80);
});

test('the temporal year display keeps shuffling for 5 seconds', () => {
    const app = loadApp();
    app.window.myAppScope.createPlayer('video-id', 'cine', null);
    app.players[1].options.events.onStateChange({ data: 1, target: app.players[1] });
    [...app.timers.values()].find(timer => timer.delay === 7000).callback();
    [...app.timers.values()].find(timer => timer.delay === 53000).callback();
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
