// 需要先安装 ws: npm install ws
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

// 检查 dist 目录是否存在
const distPath = path.join(__dirname, '../dist/index.js');
if (!fs.existsSync(distPath)) {
  console.error('❌ 错误: dist 目录不存在或未构建项目');
  console.error('   请先运行: pnpm run build 或 npm run build');
  process.exit(1);
}

try {
  const { WebSocketChannel, serviceHost } = require('../dist/index.js');

  // 继续执行服务器代码...
  startServer(WebSocketChannel, serviceHost);
} catch (error) {
  console.error('❌ 加载模块失败:', error.message);
  console.error('   请确保已构建项目: pnpm run build');
  process.exit(1);
}

function startServer(WebSocketChannel, serviceHost) {
  // 创建 WebSocket 服务器
  const PORT = 3456;
  const wss = new WebSocketServer({ port: PORT });

  wss.on('listening', () => {
    console.log(`🚀 WebSocket 服务器已启动在 ws://localhost:${PORT}`);
    console.log('   等待客户端连接...');
  });

  wss.on('error', (error) => {
    console.error('❌ WebSocket 服务器错误:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(
        `   端口 ${PORT} 已被占用，请使用其他端口或关闭占用该端口的程序`
      );
    }
    process.exit(1);
  });

  // 定义服务器端的方法
  const serverImpl = {
    now: () => {
      console.log('[Server] now() called');
      return Date.now();
    },
    echo: (x) => {
      console.log('[Server] echo() called with:', x);
      return x;
    },
    add: (a, b) => {
      console.log(`[Server] add(${a}, ${b}) called`);
      return a + b;
    },
  };

  // 当有新的 WebSocket 连接时
  wss.on('connection', (ws) => {
    console.log('[Server] 新的 WebSocket 连接已建立');

    // 为每个连接创建 WebSocketChannel
    const channel = new WebSocketChannel(ws, {
      name: 'websocket-server',
      connected: true, // WebSocket 连接已建立，所以设置为已连接
    });

    // 激活连接（触发连接事件，恢复待发送的条目）
    channel.activate();

    // 注册服务
    const service = serviceHost.registerService('server', serverImpl);
    service.setChannel(channel);

    // 监听连接关闭
    ws.on('close', () => {
      console.log('[Server] WebSocket 连接已关闭');
    });

    // 监听错误
    ws.on('error', (error) => {
      console.error('[Server] WebSocket 错误:', error);
    });
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n[Server] 正在关闭 WebSocket 服务器...');
    wss.close(() => {
      console.log('[Server] WebSocket 服务器已关闭');
      process.exit(0);
    });
  });
}
