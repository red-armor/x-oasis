import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import { NormalizedRawMessageOutput } from '../types';

export const createSenderLogger =
  (logService: any) =>
  (channel: AbstractChannelProtocol) =>
  (value: NormalizedRawMessageOutput) => {
    const label =
      channel.identifier || channel.metadata?.processName || 'unknown';
    logService.info(`[${label}] send message`, value.data);
    return value;
  };

export const createClientLogger =
  (logService: any) =>
  (channel: AbstractChannelProtocol) =>
  (value: NormalizedRawMessageOutput) => {
    const { data } = value;
    const label =
      channel.identifier || channel.metadata?.processName || 'unknown';
    logService.info(
      `[${label}] receive message from ${channel.description}`,
      data
    );
    return value;
  };
