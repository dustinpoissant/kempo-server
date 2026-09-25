import { EventEmitter } from 'events';

const emitter = new EventEmitter();
// One listener per live router in the process; a busy test run or an embedder can legitimately hold many
emitter.setMaxListeners(0);

/*
  Registers a router's rescan callback and returns the function that removes it. A router has to unregister
  when its server goes away: the emitter is module-level, so a listener that is never removed is called on
  every later rescan for as long as the process lives, scanning a directory nobody serves any more.
*/
export const onRescan = callback => {
  emitter.on('rescan', callback);
  return () => { emitter.off('rescan', callback); };
};

/*
  Rescans every router in the process and resolves with the largest file count, so with the usual single
  router it is simply that router's count. It waits for all of them rather than taking whichever answers
  first: first-to-answer made the result depend on scan speed, and a router whose root had been deleted
  (0 files, instantly) would beat a live one and report 0.
*/
export default () => new Promise((resolve, reject) => {
  const listeners = emitter.listenerCount('rescan');
  if(listeners === 0){
    resolve(0);
    return;
  }

  let pending = listeners;
  let largest = null;
  let firstError = null;

  emitter.emit('rescan', (error, fileCount) => {
    if(error) firstError = firstError || error;
    else if(largest === null || fileCount > largest) largest = fileCount;

    if(--pending > 0) return;
    if(largest === null) reject(firstError);
    else resolve(largest);
  });
});
