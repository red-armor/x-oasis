import {
  MessageChannel as RPCMessageChannel,
  serviceHost,
  clientHost,
} from '../dist/async-call-rpc.esm.js';

let channel = null;

// 监听来自主窗口的消息
window.addEventListener('message', (event) => {
  if (event.data === 'init' && event.ports && event.ports.length > 0) {
    console.log('[Iframe] Received port from main window');

    // 使用接收到的 port
    channel = new RPCMessageChannel({
      port: event.ports[0],
      sender: window,
      targetOrigin: '*',
    });

    const impl = {
      iframeHello: () => {
        console.log('[Iframe] iframeHello called');
        return 'hello from iframe test';
      },
    };

    const service = serviceHost.registerService('test-iframe', impl);
    service.setChannel(channel);

    setTimeout(() => {
      if (channel) {
        const client = clientHost
          .registerClient('test', {
            channel,
          })
          .createProxy();

        client.mainHello().then((result) => {
          console.log('[Iframe] ✅ 成功调用 mainHello，收到结果:', result);
        });
      }
    }, 1000);
  }
});
