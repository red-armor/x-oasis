import RPCServiceHost from '../endpoint/RPCServiceHost';
import AbstractChannelProtocol from '../AbstractChannelProtocol';
import { ResponseType } from '../types';

export const handleAcquirePort = (props: {
  protocol: AbstractChannelProtocol;
  serviceHost: RPCServiceHost;
  requestPath: string;
  fnName: string;
  seqId: string;
  args: any[];
}) => {
  const { serviceHost, requestPath, fnName, protocol, seqId, args } = props;

  const handler = serviceHost.getHandler(requestPath, fnName);

  const port = handler?.(args);

  // 比如port process它监听的是message；你用process创建一个ProcessChannelProtocol
  // 都会触发监听，这个时候并不一定有值返回，其实正常是否考虑将on message这种
  // emitter收敛了，即使你new了，但其实是一个实例
  if (!port) {
    // console.error('may trigger message listener', protocol)
  }

  let responseHeader = [ResponseType.PortSuccess, seqId];
  let responseBody: any[] = [];
  let sendData = null;
  try {
    responseBody = [];
    sendData = protocol.writeBuffer.encode([responseHeader, responseBody]);
  } catch (err) {
    responseHeader = [ResponseType.PortFail, seqId];
    sendData = protocol.writeBuffer.encode([responseHeader, []]);
    console.error(
      `[handleRequest sendReply encode error ] ${requestPath} ${fnName}`,
      err
    );
  }

  return port ? [sendData, [port]] : null;
};
