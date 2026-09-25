import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomHandler } from '../netlify/functions/_shared/room-core.mjs';

function fakeStore() {
  const data = new Map();
  return {
    data,
    async setJSON(key, value) { data.set(key, value); },
    async get(key) { return data.get(key) || null; },
    async delete(key) { data.delete(key); },
    async list({ prefix }) { return { blobs: [...data.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }; }
  };
}

function request(action, code, method = 'GET', body, token) {
  const url = `https://example.test/.netlify/functions/room?action=${action}${code ? `&code=${code}` : ''}`;
  return new Request(url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
}

test('multiple phone scans reach the host in order and only the host can acknowledge them', async () => {
  const store = fakeStore();
  let now = 1000;
  const handle = createRoomHandler(store, () => now++);
  const { code, hostToken } = await (await handle(request('create', null, 'POST'))).json();
  assert.equal((await handle(request('join', code))).status, 200);
  const first = await handle(request('submit', code, 'POST', { qr: 'https://cards.test/?c=abcdefghijk&s=30' }));
  const second = await handle(request('submit', code, 'POST', { qr: '?ma=12345678901' }));
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal((await handle(request('poll', code))).status, 403);
  const { events } = await (await handle(request('poll', code, 'GET', null, hostToken))).json();
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(event => event.category), ['cine', 'musica_audio']);
  assert.equal((await handle(request('ack', code, 'POST', { id: events[0].id }, hostToken))).status, 200);
  assert.equal((await (await handle(request('poll', code, 'GET', null, hostToken))).json()).events.length, 1);
});

test('invalid cards are rejected and closed or expired rooms cannot receive scans', async () => {
  const store = fakeStore();
  let now = 1000;
  const handle = createRoomHandler(store, () => now);
  const { code, hostToken } = await (await handle(request('create', null, 'POST'))).json();
  assert.equal((await handle(request('submit', code, 'POST', { qr: '?c=bad' }))).status, 400);
  assert.equal((await handle(request('close', code, 'POST', {}, hostToken))).status, 200);
  assert.equal((await handle(request('join', code))).status, 404);
  const another = await (await handle(request('create', null, 'POST'))).json();
  now += 4 * 60 * 60 * 1000;
  assert.equal((await handle(request('submit', another.code, 'POST', { qr: '?c=abcdefghijk' }))).status, 404);
});
