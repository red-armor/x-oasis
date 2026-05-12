export const ORCHESTRATOR_CP_CHANNEL_NAME = 'multi-page-router-cp';
export const ORCHESTRATOR_PROJECT_NAME = 'multi-page-router-di';

export const PAGES = [
  {
    id: 'pageA',
    label: 'Page A',
    color: '#3b82f6',
    description: 'Dashboard & Monitoring',
  },
  {
    id: 'pageB',
    label: 'Page B',
    color: '#8b5cf6',
    description: 'Configuration & Settings',
  },
  {
    id: 'pageC',
    label: 'Page C',
    color: '#10b981',
    description: 'System & Diagnostics',
  },
] as const;

export type PageConfig = (typeof PAGES)[number];

export function getPageletId(pageId: string): string {
  return `pagelet-${pageId.replace('page', '').toUpperCase()}`;
}

export const PAGELET_IDS = PAGES.map((p) => getPageletId(p.id));

export const RENDERER_PARTICIPANT_ID = 'renderer';
export const SHARED_PARTICIPANT_ID = 'shared';
export const DAEMON_PARTICIPANT_ID = 'daemon';
