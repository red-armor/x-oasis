import { WorkerChannel } from '@x-oasis/async-call-rpc-web';
import { serviceHost } from '@x-oasis/async-call-rpc';

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

    isPrime(n: number): boolean {
      if (n <= 1) return false;
      if (n <= 3) return true;
      if (n % 2 === 0 || n % 3 === 0) return false;
      for (let i = 5; i * i <= n; i += 6) {
        if (n % i === 0 || n % (i + 2) === 0) return false;
      }
      return true;
    },
  },
});
