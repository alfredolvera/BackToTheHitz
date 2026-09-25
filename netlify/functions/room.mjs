import { getStore } from '@netlify/blobs';
import { createRoomHandler } from './_shared/room-core.mjs';

export default async function room(request) {
  const store = getStore({ name: 'back-to-the-hitz-rooms', consistency: 'strong' });
  return createRoomHandler(store)(request);
}
