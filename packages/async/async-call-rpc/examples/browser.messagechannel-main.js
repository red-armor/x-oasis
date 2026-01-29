import {
  MessageChannel as RPCMessageChannel,
  serviceHost,
  clientHost,
} from '../dist/async-call-rpc.esm.js';

// 创建 Web API MessageChannel
const { port1, port2 } = new MessageChannel();

// 创建 iframe
const iframe = document.createElement('iframe');
iframe.src = new URL(
  './browser.messagechannel-iframe.html',
  import.meta.url
).href;
document.body.appendChild(iframe);

iframe.onload = () => {
  console.log('[Main] iframe loaded');

  // 将 port2 传递给 iframe
  iframe.contentWindow.postMessage('init', '*', [port2]);

  // 在主窗口使用 port1
  const channel = new RPCMessageChannel({
    port: port1,
    sender: window,
    targetOrigin: '*',
  });

  const impl = {
    mainHello: () => {
      console.log('[Main] mainHello called');
      return 'hello from main test';
    },
  };

  const service = serviceHost.registerService('test', impl);
  service.setChannel(channel);

  setTimeout(() => {
    const client = clientHost
      .registerClient('test-iframe', {
        channel,
      })
      .createProxy();

    client.iframeHello().then((result) => {
      console.log('[Main] ✅ 成功调用 iframeHello，收到结果:', result);
    });
  }, 1000);
};
