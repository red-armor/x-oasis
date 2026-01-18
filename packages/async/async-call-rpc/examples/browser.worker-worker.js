// import * as rpc from '../out/base.mjs'
// import { WorkerChannel } from '../utils/web/worker.js'

import { WorkerChannel, rpcClientHost } from '../dist/async-call-rpc.esm.js';

const channel = new WorkerChannel();

const client = rpcClientHost.registerClient('test');
client.setChannel(channel);

// const impl = {
//     workHello: () => 'hello from worker',
// }
// console.log('[Worker] Creating AsyncCall and calling mainHello...')
// const host = rpc.AsyncCall(impl, { channel: new WorkerChannel(), log: false })
client.mainHello().then((result) => {
  console.log('[Worker] Received result:', result);
});
