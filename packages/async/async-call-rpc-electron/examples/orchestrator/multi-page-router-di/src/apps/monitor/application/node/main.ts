import { Container, Registry } from '@x-oasis/di';
import {
  MonitorPageletWorker,
  MonitorPageletWorkerId,
} from './MonitorPageletWorker';

const container = new Container();
container.load(
  new Registry((bind) => {
    bind(MonitorPageletWorkerId).to(MonitorPageletWorker);
  })
);

const worker = container.get(MonitorPageletWorkerId) as MonitorPageletWorker;
worker
  .boot()
  .catch((err) => console.error('[monitor-worker] boot failed:', err));
