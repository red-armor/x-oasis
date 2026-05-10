/**
 * @x-oasis/async-call-rpc-electron — UtilityProcess 示例（主进程侧）
 *
 * 启动方式：
 *   cd packages/async/async-call-rpc-electron/examples/utility-process-example
 *   npm install    # 安装 electron（约 90MB 下载）
 *   npm start      # 启动 Electron 应用
 *
 * 本示例展示：
 * 1. 使用 utilityProcess.fork() 创建子进程
 * 2. 使用 ElectronUtilityProcessChannel 建立 RPC 通道
 * 3. 主进程作为 Client 调用 Utility 进程提供的服务
 * 4. 主进程同时作为 Service 供 Utility 进程回调
 */

import { app, utilityProcess } from 'electron';
import { ElectronUtilityProcessChannel } from '../../../src/index.ts';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

import path from 'path';

// ─── 接口定义 ────────────────────────────────────────────────────────────────

/** Utility 进程提供的计算服务接口 */
interface WorkerService {
  /** 处理图片并返回处理结果 */
  processImage(params: {
    imagePath: string;
    options: { width: number; height: number; quality: number };
  }): Promise<{ dataSize: number; width: number; height: number }>;

  /** 压缩文本数据 */
  compress(params: {
    data: string;
    algorithm: 'gzip' | 'deflate';
  }): Promise<string>;

  /** 计算文件哈希 */
  hashFile(filePath: string): Promise<string>;

  /** 执行重量级数据分析 */
  analyzeData(data: number[]): Promise<{
    mean: number;
    median: number;
    stddev: number;
  }>;
}

// ─── Fork Utility 进程并建立 RPC 通道 ────────────────────────────────────────

function createWorker() {
  // fork 一个 Utility 进程
  // Electron 的 utilityProcess.fork 不支持 execArgv，
  // 但 Electron 主进程已通过 --import tsx 注册了 tsx loader，
  // 子进程会继承这个设置
  const child = utilityProcess.fork(path.join(__dirname, 'utility-worker.ts'));

  // 使用 ElectronUtilityProcessChannel 包装子进程
  // 主进程侧传入 `process` 参数
  const channel = new ElectronUtilityProcessChannel({
    process: child,
    description: 'main→utility worker RPC',
  });

  // ── 主进程作为 Client ──
  // 调用 Utility 进程中注册的服务
  const worker = clientHost
    .registerClient('worker', { channel })
    .createProxy<WorkerService>();

  // ── 主进程同时作为 Service（可选） ──
  // 让 Utility 进程可以回调主进程的方法
  serviceHost.registerService('main-callbacks', {
    channel,
    serviceHost,
    handlers: {
      /** 报告进度 */
      reportProgress: (params: { taskId: string; progress: number }) => {
        console.log(`[Task ${params.taskId}] Progress: ${params.progress}%`);
      },

      /** 记录日志到主进程 */
      log: (params: { level: string; message: string }) => {
        console.log(`[Utility][${params.level}] ${params.message}`);
      },
    },
  });

  return { child, worker, channel };
}

// ─── 使用示例 ────────────────────────────────────────────────────────────────

async function main() {
  // utilityProcess.fork() 只能在 app ready 之后调用
  await app.whenReady();

  const { worker, child, channel } = createWorker();

  // 等待子进程就绪
  await new Promise<void>((resolve) => {
    child.on('spawn', resolve);
  });

  try {
    // 1. 数据压缩（多参数用对象包装）
    const compressed = await worker.compress({
      data: 'Hello, World! '.repeat(1000),
      algorithm: 'gzip',
    });
    console.log('Compressed data length:', compressed.length);

    // 2. 数据分析（单参数直接传）
    const stats = await worker.analyzeData([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    console.log('Analysis result:', stats);
    // { mean: 5.5, median: 5.5, stddev: 2.87 }

    // 3. 调用图片处理（模拟，多参数用对象包装）
    const result = await worker.processImage({
      imagePath: '/tmp/test-image.png',
      options: { width: 100, height: 100, quality: 85 },
    });
    console.log('Image processed:', result);
  } catch (error) {
    console.error('Worker error:', error);
  } finally {
    // 清理：断开通道并退出
    channel.disconnect();
    console.log('Worker terminated, exiting.');
    app.quit();
  }
}

main().catch(console.error);
