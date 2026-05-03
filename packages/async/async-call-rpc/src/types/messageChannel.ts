import { AbstractChannelProtocolProps as BaseAbstractChannelProtocolProps } from './protocol';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

export type OnMessageEntry = {
  data: any;
  ports: any;
};
export type SenderEntry = any;

export type ClientMiddleware = (
  channel?: AbstractChannelProtocol
) => (v: OnMessageEntry) => OnMessageEntry;

export type SenderMiddleware = (
  channel?: AbstractChannelProtocol
) => (data: SenderEntry) => SenderEntry;

/**
 * Extended AbstractChannelProtocolProps for message channel protocols.
 * Includes additional middleware configuration options.
 */
export type AbstractChannelProtocolProps = BaseAbstractChannelProtocolProps & {
  clientMiddlewares?: ClientMiddleware[];
  senderMiddlewares?: SenderMiddleware[];
};
