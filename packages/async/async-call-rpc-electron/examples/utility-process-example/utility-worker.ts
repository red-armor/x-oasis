/**
 * @x-oasis/async-call-rpc-electron — UtilityProcess 示例（Utility 进程侧）
 *
 * 本文件由主进程通过 utilityProcess.fork() 启动。
 *
 * 本示例展示：
 * 1. 使用 process.parentPort 建立与主进程的 RPC 通道
 * 2. 注册计算服务供主进程调用
 * 3. 反向调用主进程提供的回调方法
 */

import { ElectronUtilityProcessChannel } from '../../src/index.ts';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

import crypto from 'crypto';
import fs from 'fs';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);

// ─── 主进程回调接口（与主进程 registerService 的 handlers 对应） ───────────────

interface MainCallbacks {
  reportProgress(params: { taskId: string; progress: number }): Promise<void>;
  log(params: { level: string; message: string }): Promise<void>;
}

// ─── 建立 RPC 通道 ───────────────────────────────────────────────────────────

// Utility 进程侧传入 `parentPort` 参数
const channel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort,
  description: 'utility→main RPC',
});

// ── 注册本进程提供的服务 ──
serviceHost.registerService('worker', {
  channel,
  serviceHost,
  handlers: {
    /**
     * 处理图片（模拟）
     * 实际项目中可使用 sharp 等库
     *
     * 注意：RPC handler 只接收一个参数（body[0]），
     * 多参数需要用对象包装。
     */
    processImage: async (params: {
      imagePath: string;
      options: { width: number; height: number; quality: number };
    }) => {
      const { imagePath, options } = params;

      // 通知主进程进度（同样需要用对象包装）
      await mainCallbacks.reportProgress({
        taskId: 'image-process',
        progress: 10,
      });
      await mainCallbacks.log({
        level: 'info',
        message: `Processing image: ${imagePath}`,
      });

      // 模拟图片处理耗时
      await new Promise((resolve) => setTimeout(resolve, 100));
      await mainCallbacks.reportProgress({
        taskId: 'image-process',
        progress: 50,
      });

      // 模拟返回处理后的数据（使用 plain object，因为 Buffer 不能直接 JSON 序列化）
      const dataSize = options.width * options.height * 4;
      await mainCallbacks.reportProgress({
        taskId: 'image-process',
        progress: 100,
      });

      return { dataSize, width: options.width, height: options.height };
    },

    /**
     * 压缩文本数据
     */
    compress: async (params: {
      data: string;
      algorithm: 'gzip' | 'deflate';
    }) => {
      const { data, algorithm } = params;
      const input = Buffer.from(data, 'utf-8');
      const compressed =
        algorithm === 'gzip' ? await gzip(input) : await deflate(input);
      return compressed.toString('base64');
    },

    /**
     * 计算文件哈希
     */
    hashFile: async (filePath: string) => {
      return new Promise<string>((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
      });
    },

    /**
     * 数据分析
     * 在独立进程中执行，不阻塞主进程和 UI
     */
    analyzeData: async (data: number[]) => {
      const n = data.length;
      if (n === 0) {
        return { mean: 0, median: 0, stddev: 0 };
      }

      // 均值
      const mean = data.reduce((a, b) => a + b, 0) / n;

      // 中位数
      const sorted = [...data].sort((a, b) => a - b);
      const median =
        n % 2 === 0
          ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
          : sorted[Math.floor(n / 2)];

      // 标准差
      const variance =
        data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
      const stddev = Math.round(Math.sqrt(variance) * 100) / 100;

      return { mean, median, stddev };
    },
  },
});

// ── 反向调用主进程方法（可选） ──
// 如果主进程也注册了服务，Utility 进程可以作为 Client 调用
const mainCallbacks = clientHost
  .registerClient('main-callbacks', { channel })
  .createProxy<MainCallbacks>();

// ─── 说明 ────────────────────────────────────────────────────────────────────
//
// 本文件由主进程通过 utilityProcess.fork() 启动。
//
// Utility 进程是一个独立的 Node.js 进程（不含 Chromium），
// 适合执行 CPU 密集型任务，不会阻塞主进程和渲染进程的 UI。
//
// process.parentPort 是 Electron 在 Utility 进程中注入的特殊对象，
// 提供 postMessage / on('message') 接口与主进程通信。
