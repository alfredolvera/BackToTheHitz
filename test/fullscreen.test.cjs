const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('fullscreen.js', 'utf8');

function setup(supported = true) {
    const listeners = {};
    const classes = new Set();
    const attributes = {};
    const button = {
        hidden: false,
        classList: {
            toggle(name, active) { active ? classes.add(name) : classes.delete(name); }
        },
        setAttribute(name, value) { attributes[name] = value; },
        addEventListener(name, listener) { listeners[`button:${name}`] = listener; }
    };
    const document = {
        fullscreenEnabled: supported,
        fullscreenElement: null,
        getElementById() { return button; },
        addEventListener(name, listener) { listeners[name] = listener; },
        exitFullscreen() {
            this.fullscreenElement = null;
            listeners.fullscreenchange();
            return Promise.resolve();
        }
    };
    document.documentElement = {
        requestFullscreen() {
            document.fullscreenElement = this;
            listeners.fullscreenchange();
            return Promise.resolve();
        }
    };
    vm.runInNewContext(source, { document, console });
    return { button, listeners, classes, attributes };
}

test('fullscreen button enters and exits fullscreen and updates its accessible label', () => {
    const { button, listeners, classes, attributes } = setup();
    assert.equal(button.hidden, false);
    assert.equal(attributes['aria-label'], 'Activar pantalla completa');
    listeners['button:click']();
    assert.equal(attributes['aria-pressed'], 'true');
    assert.equal(attributes['aria-label'], 'Salir de pantalla completa');
    assert.equal(classes.has('is-fullscreen'), true);
    listeners['button:click']();
    assert.equal(attributes['aria-pressed'], 'false');
    assert.equal(classes.has('is-fullscreen'), false);
});

test('fullscreen button is hidden when fullscreen is unavailable', () => {
    const { button, listeners } = setup(false);
    assert.equal(button.hidden, true);
    assert.equal(listeners['button:click'], undefined);
});
