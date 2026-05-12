export const ORCHESTRATOR_CP_CHANNEL_NAME = 'multi-page-router-cp';
export const ORCHESTRATOR_PROJECT_NAME = 'multi-page-router-di';

export const CONNECTION_PAGE = {
  id: 'connection',
  label: 'Connection',
  color: '#3b82f6',
  description: 'Connection Management',
} as const;

export type PageConfig = typeof CONNECTION_PAGE;
