import AbstractChannelProtocol from '../AbstractChannelProtocol';
import { NormalizedRawMessageOutput } from '../../types';

export const createSenderLogger =
  (logService: any) =>
  (channel: AbstractChannelProtocol) =>
  (value: NormalizedRawMessageOutput) => {
    logService.info(`${channel.masterProcessName} send message`, value.data);
    return value;
  };

export const createClientLogger =
  (logService: any) =>
  (channel: AbstractChannelProtocol) =>
  (value: NormalizedRawMessageOutput) => {
    const { data } = value;
    logService.info(
      `${channel.masterProcessName} receive message from ${channel.description}`,
      data
    );
    return value;
  };
