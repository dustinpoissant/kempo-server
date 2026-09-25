import { sockets, broadcast } from '../../../src/websocket/index.js';

/*
  Demonstrates reaching connected sockets from ordinary HTTP code. A real consumer imports
  'kempo-server/websocket'; this file uses a relative path because it runs from inside the package.
*/
export default async (request, response) => {
  const { text = 'hello from HTTP', room = 'general' } = request.body || {};

  const delivered = broadcast(JSON.stringify({ type: 'push', text }), {
    path: '/echo',
    filter: (socket) => socket.data.room === room
  });

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ delivered, connected: sockets().length }));
};
