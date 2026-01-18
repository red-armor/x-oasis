// import isPromise from '@x-oasis/is-promise';
// import { ResponseType, DeserializedMessageOutput } from '../types';
// import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
// import {
//   isEventMethod,
//   isAssignPassingPortMethod,
//   isAcquirePortMethod,
// } from '../common';
// import { handleAcquirePort } from './handleRequestUtils';

// export const handleRequest =
//   (protocol: AbstractChannelProtocol) =>
//   (message: DeserializedMessageOutput) => {
//     const service = protocol.service;

//     const { data, event: messageEvent, ports } = message;
//     const header = data[0];

//     // TODO: protocol.channelName will cause error, check `acquirePortMain.ts#171`
//     // const channelName = header[4] || protocol.channelName;

//     const body = data[1];
//     const type = header[0] as any;

//     if (Object.values(ResponseType).includes(type)) {
//       return message;
//     }

//     const seqId = header[1];
//     const requestPath = header[2];
//     const methodName = header[3];
//     const args = body[0];

//     const handler = service.getHandler(methodName);

//     if (service) {
//       if (isEventMethod(methodName)) {
//         const event = service.getHandler(methodName);

//         const fn = (...args: any[]) => {
//           const responseHeader = [ResponseType.ReturnSuccess, seqId];
//           let responseBody = [];
//           let sendData = null;
//           try {
//             responseBody = args;
//             sendData = protocol.writeBuffer.encode([
//               responseHeader,
//               responseBody,
//             ]);
//           } catch (err) {
//             sendData = protocol.writeBuffer.encode([responseHeader, []]);
//             console.error(
//               `[handleRequest sendReply encode error ] ${requestPath} ${methodName}`,
//               err
//             );
//           }

//           // TODO: temp; main <=> project renderer...
//           if (messageEvent?.sender) {
//             messageEvent.sender.send(channelName, sendData);
//             return;
//           }

//           protocol.sendReply(sendData);
//         };

//         event?.(fn);
//         return message;
//       }

//       /**
//        * AssignPassingPort
//        */
//       if (isAssignPassingPortMethod(methodName)) {
//         const handler = serviceHost.getHandler(requestPath, methodName);

//         if (handler) args ? handler(args, ports?.[0]) : handler(ports?.[0]);
//         // no need send reply
//         return;
//       }

//       if (isAcquirePortMethod(methodName)) {
//         const result = handleAcquirePort({
//           protocol,
//           serviceHost,
//           methodName,
//           seqId,
//           args,
//           requestPath,
//         });

//         // 目前简单处理，只有port的时候才返回，其实是需要返回PortFail的；进入
//         // client的catch
//         if (result) {
//           protocol.sendReply(...result);
//         }
//         return;
//       }

//       const handler = serviceHost.getHandler(requestPath, methodName);

//       const _result = handler?.(args);

//       // todo
//       const result = Promise.resolve(_result);

//       if (isPromise(result)) {
//         result.then(
//           (response: any) => {
//             const responseHeader = [ResponseType.ReturnSuccess, seqId];
//             let responseBody = [];
//             let sendData = null;
//             try {
//               responseBody = [response];
//               sendData = protocol.writeBuffer.encode([
//                 responseHeader,
//                 responseBody,
//               ]);
//             } catch (err) {
//               sendData = protocol.writeBuffer.encode([responseHeader, []]);
//               console.error(
//                 `[handleRequest sendReply encode error ] ${requestPath} ${methodName}`,
//                 err
//               );
//             }

//             // TODO: temp; main <=> project renderer...
//             if (messageEvent?.sender) {
//               messageEvent.sender.send(channelName, sendData);
//               return;
//             }

//             protocol.sendReply(sendData);
//           },
//           (err: Error) => {
//             const responseHeader = [ResponseType.ReturnFail, seqId];
//             const responseBody = [
//               {
//                 message: err.message,
//                 name: err.name,
//                 // eslint-disable-next-line
//                 stack: err.stack
//                   ? err.stack.split
//                     ? err.stack.split('\n')
//                     : err.stack
//                   : undefined,
//               },
//             ];

//             if (messageEvent?.sender) {
//               messageEvent.sender.send(
//                 protocol.channelName,
//                 protocol.writeBuffer.encode([responseHeader, responseBody])
//               );
//               return;
//             }

//             protocol.sendReply(
//               protocol.writeBuffer.encode([responseHeader, responseBody])
//             );
//           }
//         );
//       }
//     }
//   };
