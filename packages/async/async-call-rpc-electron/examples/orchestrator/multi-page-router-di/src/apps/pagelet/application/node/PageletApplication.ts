import { createId, inject, injectable } from '@x-oasis/di';

import {
  IPageletProcess,
  PageletProcessId,
} from '../electron-main/PageletProcess';
import { AppOrchestratorId } from '../electron-main/AppOrchestrator';

export interface IPageletApplication {
  start(): Promise<void>;
}

export const PageletApplicationId = createId('PageletApplication');

@injectable()
export class PageletApplication implements IPageletApplication {
  constructor(
    @inject(PageletProcessId) private readonly pageletProcess: IPageletProcess,
    @inject(AppOrchestratorId)
    private readonly appOrchestrator: {
      registerOrchestratorService(): void;
    }
  ) {}

  async start(): Promise<void> {
    await this.pageletProcess.spawn();
    this.appOrchestrator.registerOrchestratorService();
  }
}
