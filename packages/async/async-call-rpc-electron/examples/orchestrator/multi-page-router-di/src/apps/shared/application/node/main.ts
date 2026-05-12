import { Container, Registry } from '@x-oasis/di';
import { SharedWorker, SharedWorkerId } from './SharedWorker';

const container = new Container();
container.load(
  new Registry((bind) => {
    bind(SharedWorkerId).to(SharedWorker);
  })
);

const worker = container.get(SharedWorkerId) as SharedWorker;
worker.boot();
