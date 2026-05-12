import { Container, Registry } from '@x-oasis/di';
import {
  PageletWorker,
  PageletWorkerId,
  PageletWorkerConfigId,
} from './node/PageletWorker';

const SELF_ID = 'pagelet-B';
const RENDERER_ID = 'renderer';

const container = new Container();
container.load(
  new Registry((bind) => {
    bind(PageletWorkerConfigId).toConstantValue({
      selfId: SELF_ID,
      rendererParticipantId: RENDERER_ID,
    });
    bind(PageletWorkerId).to(PageletWorker);
  })
);

const worker = container.get(PageletWorkerId) as PageletWorker;
worker
  .boot()
  .catch((err) => console.error(`[${SELF_ID}-worker] boot failed:`, err));
