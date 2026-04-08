import { EventEmitter } from 'events';

const emitter = new EventEmitter();

export const onRescan = callback => {
  emitter.on('rescan', callback);
};

export default () => new Promise((resolve, reject) => {
  emitter.emit('rescan', (error, fileCount) => {
    if(error) reject(error);
    else resolve(fileCount);
  });
});
