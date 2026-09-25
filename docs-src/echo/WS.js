/*
  Live echo route backing the WebSockets demo page. Tags each connection with the room from the query
  string so the push endpoint next door can select a subset of them.
*/
export default async (request, socket) => {
  socket.data.room = request.query.room || 'general';

  socket.send(JSON.stringify({
    type: 'joined',
    room: socket.data.room,
    at: new Date().toISOString()
  }));

  socket.on('message', (data, isBinary) => {
    if(isBinary){
      socket.send(JSON.stringify({
        type: 'binary',
        bytes: Array.from(data)
      }));
      return;
    }
    socket.send(JSON.stringify({ type: 'echo', text: data }));
  });
};
