import {
  WebSocketChannel,
  serviceHost,
  clientHost,
} from '../dist/async-call-rpc.esm.js';

// 创建 WebSocket 连接
const ws = new WebSocket('ws://localhost:3456');

// 创建 WebSocketChannel
const channel = new WebSocketChannel(ws, {
  name: 'websocket-client',
});

// 等待 WebSocket 连接建立
ws.addEventListener('open', () => {
  console.log('[Client] WebSocket 连接已建立');
  // 触发自定义事件，通知 HTML 页面
  window.dispatchEvent(new Event('websocket-open'));

  // 注册服务（如果需要双向通信）
  const impl = {
    clientHello: () => {
      console.log('[Client] clientHello called');
      return 'hello from client';
    },
  };

  const service = serviceHost.registerService('client', impl);
  service.setChannel(channel);

  // 创建 RPC 客户端代理
  setTimeout(() => {
    const client = clientHost
      .registerClient('server', {
        channel,
      })
      .createProxy();

    // 将客户端代理暴露到全局，方便在控制台测试
    window.server = client;
    window.remote = client;

    // 自动测试
    testConnection(client);
  }, 100);
});

// 监听连接错误
ws.addEventListener('error', (error) => {
  console.error('[Client] WebSocket 错误:', error);
  console.error('[Client] 请确保:');
  console.error(
    '  1. WebSocket 服务器正在运行 (node node.websocket.server.js)'
  );
  console.error('  2. 服务器监听在 ws://localhost:3456');
  console.error('  3. 没有防火墙阻止连接');
  // 触发自定义事件，通知 HTML 页面
  window.dispatchEvent(new Event('websocket-error'));
});

// 监听连接关闭
ws.addEventListener('close', (event) => {
  console.log('[Client] WebSocket 连接已关闭', {
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean,
  });

  if (!event.wasClean) {
    console.warn('[Client] 连接异常关闭，可能的原因:');
    console.warn('  - 服务器未运行');
    console.warn('  - 网络问题');
    console.warn('  - 端口被占用');
  }
});

// 测试连接和基本功能
async function testConnection(client) {
  console.log('=== WebSocket RPC 测试 ===');

  try {
    // 测试 1: echo 方法 - 回显参数
    console.log('\n1. 测试 echo 方法:');
    const echoResult = await client.echo('Hello from browser!');
    console.log('   echo("Hello from browser!") =>', echoResult);

    // 测试 2: now 方法 - 获取当前时间戳
    console.log('\n2. 测试 now 方法:');
    const timestamp = await client.now();
    console.log('   now() =>', timestamp);
    console.log('   转换为日期:', new Date(timestamp).toLocaleString());

    // 测试 3: echo 复杂对象
    console.log('\n3. 测试 echo 复杂对象:');
    const complexObj = { name: 'test', value: 42, nested: { data: [1, 2, 3] } };
    const complexResult = await client.echo(complexObj);
    console.log('   echo(complexObj) =>', complexResult);

    console.log('\n✅ 所有测试通过！');
    console.log('\n💡 提示: 你可以在控制台中使用以下方式测试:');
    console.log('   - await server.echo("你的消息")');
    console.log('   - await server.now()');
    console.log('   - await window.remote.echo("测试")');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error(
      '   请确保 WebSocket 服务器正在运行 (node node.websocket.server.js)'
    );
  }
}

console.log('📡 WebSocket RPC 客户端已加载');
console.log('   - 服务器对象: window.server 或 window.remote');
console.log('   - 等待连接建立...');
