const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('joining hides the code form and a submitted scan hides the empty camera preview', async () => {
    const elements = new Map();
    let onScan;
    const get = id => {
        if (!elements.has(id)) elements.set(id, {
            value: '', textContent: '', innerHTML: '', hidden: id === 'guest-connected' || id === 'guest-scan-again',
            addEventListener(name, callback) { this[name] = callback; }
        });
        return elements.get(id);
    };
    class Html5Qrcode {
        async start(camera, config, success) { onScan = success; }
        async stop() {}
    }
    const calls = [];
    const context = {
        document: { getElementById: get },
        Html5Qrcode,
        window: {}, navigator: {},
        location: { search: '' },
        history: { replaceState() {} },
        URLSearchParams, encodeURIComponent, console,
        fetch: async (url, options) => {
            calls.push({ url, options });
            return { ok: true, json: async () => ({}) };
        }
    };
    vm.runInNewContext(fs.readFileSync('guest.js', 'utf8'), context);
    get('guest-room-code').value = 'ZR9FS39';
    await get('join-form').submit({ preventDefault() {} });
    assert.equal(get('join-form').hidden, true);
    assert.equal(get('guest-connected').hidden, false);
    assert.equal(get('qr-reader').hidden, false);
    await onScan('?c=abcdefghijk');
    assert.equal(get('qr-reader').hidden, true);
    assert.equal(get('guest-scan-again').hidden, false);
    assert.equal(calls.length, 2);
    await get('guest-scan-again').click();
    assert.equal(get('qr-reader').hidden, false);
});
