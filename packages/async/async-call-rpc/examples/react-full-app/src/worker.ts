import { WorkerChannel, serviceHost } from '@x-oasis/async-call-rpc';

const channel = new WorkerChannel(self, { name: 'worker-thread' });

serviceHost.registerService('compute', {
  channel,
  serviceHost,
  handlers: {
    fibonacci(n: number): number {
      if (n <= 1) return n;
      let a = 0,
        b = 1;
      for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
      }
      return b;
    },
  },
});
