import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const ROOM_LIFETIME_MS = 4 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

function extractCard(text) {
  if (typeof text !== 'string' || text.length > 1024) return null;
  try {
    const params = new URL(text.trim(), 'https://backtothehitz.com/').searchParams;
    const selected = [['c', 'cine'], ['g', 'juego'], ['mv', 'musica_video'], ['ma', 'musica_audio']]
      .filter(([key]) => params.has(key));
    if (selected.length !== 1) return null;
    const [key, category] = selected[0];
    const videoId = params.get(key);
    const startTime = params.get('s') || null;
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || (startTime !== null && (!/^\d{1,5}$/.test(startTime) || Number(startTime) > 36000))) return null;
    return { videoId, category, startTime };
  } catch { return null; }
}

function authorized(room, request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /i, '') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const actual = Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex');
  const expected = Buffer.from(room.hostHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createRoomHandler(store, clock = () => Date.now()) {
  return async function handleRoom(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    try {
      if (action === 'create' && request.method === 'POST') {
        const code = Array.from(randomBytes(7), byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
        const hostToken = randomBytes(32).toString('hex');
        const expiresAt = clock() + ROOM_LIFETIME_MS;
        await store.setJSON(`rooms/${code}`, { hostHash: createHash('sha256').update(hostToken).digest('hex'), expiresAt, closed: false });
        return json({ code, hostToken, expiresAt }, 201);
      }

      const code = url.searchParams.get('code')?.toUpperCase();
      if (!code || !/^[A-HJ-NP-Z2-9]{7}$/.test(code)) return json({ error: 'Código de sala no válido.' }, 400);
      const key = `rooms/${code}`;
      const room = await store.get(key, { type: 'json' });
      if (!room || room.closed || room.expiresAt <= clock()) return json({ error: 'La sala ya no está disponible.' }, 404);

      if (action === 'join' && request.method === 'GET') return json({ code, expiresAt: room.expiresAt });
      if (action === 'submit' && request.method === 'POST') {
        const card = extractCard((await request.json()).qr);
        if (!card) return json({ error: 'Esta tarjeta no contiene un video válido.' }, 400);
        const id = `${String(clock()).padStart(13, '0')}-${randomBytes(8).toString('hex')}`;
        await store.setJSON(`events/${code}/${id}`, { id, ...card });
        return json({ id, queued: true }, 201);
      }

      if (!authorized(room, request)) return json({ error: 'Sólo el host puede hacer esto.' }, 403);
      if (action === 'poll' && request.method === 'GET') {
        const { blobs } = await store.list({ prefix: `events/${code}/` });
        const events = (await Promise.all(blobs.slice(0, 100).map(blob => store.get(blob.key, { type: 'json' })))).filter(Boolean);
        events.sort((a, b) => a.id.localeCompare(b.id));
        return json({ events });
      }
      if (action === 'ack' && request.method === 'POST') {
        const { id } = await request.json();
        if (!/^\d{13}-[a-f0-9]{16}$/.test(id || '')) return json({ error: 'Evento no válido.' }, 400);
        await store.delete(`events/${code}/${id}`);
        return json({ ok: true });
      }
      if (action === 'close' && request.method === 'POST') {
        await store.setJSON(key, { ...room, closed: true });
        return json({ ok: true });
      }
      return json({ error: 'Operación no disponible.' }, 405);
    } catch (error) {
      console.error('Room request failed', error);
      return json({ error: 'No se pudo conectar con la sala.' }, 500);
    }
  };
}
