// import * as rpc from '../out/base.mjs'
// import { WorkerChannel } from '../utils/web/worker.js'

// 使用静态 import（Worker 文件已经是 ES module）
import {
  WorkerChannel,
  clientHost,
  serviceHost,
} from '../dist/async-call-rpc.esm.js';

const channel = new WorkerChannel(self, {
  name: 'worker-worker',
});

const client = clientHost
  .registerClient('test', {
    channel,
  })
  .createProxy();

client.mainHello().then((result) => {
  console.log('[Worker] ✅ 成功调用 mainHello，收到结果:', result);
});
const service = serviceHost.registerService('test-worker', {
  workerHello: () => {
    console.log('[Worker] workerHello called');
    return 'hello from worker test';
  },
});
service.setChannel(channel);
