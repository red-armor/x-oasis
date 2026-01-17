import { NormalizedRawMessageOutput } from '../../types';

export const normalizeMessageChannelRawMessage =
  () =>
  (event: MessageEvent): NormalizedRawMessageOutput => {
    return {
      event,
      data: event.data,
      ports: event.ports || [],
    };
  };

export const normalizeIPCChannelRawMessage =
  () => (event: MessageEvent, data: string) => {
    return {
      event,
      data,
      ports: event.ports || [],
    };
  };

export const processClientRawMessage = () => (data: string) => {
  return {
    event: null,
    data,
    ports: [],
  };
};
