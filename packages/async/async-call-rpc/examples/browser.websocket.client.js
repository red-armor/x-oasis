import * as MessagePack from 'https://jspm.dev/@msgpack/msgpack';
// Need to run the build first to get those files.
// import { AsyncCall } from '../out/base.mjs'
import * as rpc from '../out/base.mjs';

import { WebSocketMessageChannel } from '../utils/web/websocket.client.js';
import { Msgpack_Serialization } from '../utils/web/msgpack.js';

/** @type {typeof import('./node.websocket.server').server} */
const server = rpc.AsyncCall(
  {},
  {
    channel: new WebSocketMessageChannel('ws://localhost:3456/'),
    serializer: Msgpack_Serialization(MessagePack),
  }
);

window.remote = window.server = server;
window.ac = rpc;

// 测试连接和基本功能
async function testConnection() {
  console.log('=== WebSocket RPC 测试 ===');

  try {
    // 测试 1: echo 方法 - 回显参数
    console.log('\n1. 测试 echo 方法:');
    const echoResult = await server.echo('Hello from browser!');
    console.log('   echo("Hello from browser!") =>', echoResult);

    // 测试 2: now 方法 - 获取当前时间戳
    console.log('\n2. 测试 now 方法:');
    const timestamp = await server.now();
    console.log('   now() =>', timestamp);
    console.log('   转换为日期:', new Date(timestamp).toLocaleString());

    // 测试 3: echo 复杂对象
    console.log('\n3. 测试 echo 复杂对象:');
    const complexObj = { name: 'test', value: 42, nested: { data: [1, 2, 3] } };
    const complexResult = await server.echo(complexObj);
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

// 等待 WebSocket 连接建立后再测试
const checkConnection = setInterval(() => {
  if (server && typeof server.echo === 'function') {
    clearInterval(checkConnection);
    // 延迟一下确保连接完全建立
    setTimeout(testConnection, 500);
  }
}, 100);

// 10秒后停止检查
setTimeout(() => clearInterval(checkConnection), 10000);

console.log('📡 WebSocket RPC 客户端已加载');
console.log('   - 服务器对象: window.server 或 window.remote');
console.log('   - RPC 库: window.ac');
console.log('   - 等待连接建立...');
