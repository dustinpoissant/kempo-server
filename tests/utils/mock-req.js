import {Readable} from 'stream';

export const createMockReq = ({method = 'GET', url = '/', headers = {}, body = null, remoteAddress = '127.0.0.1'} = {}) => {
  const stream = new Readable({read(){}});
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  stream.socket = {remoteAddress};
  if(body !== null && body !== undefined){
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    setImmediate(() => {
      stream.emit('data', Buffer.from(data));
      stream.emit('end');
    });
  } else {
    setImmediate(() => stream.emit('end'));
  }
  return stream;
};