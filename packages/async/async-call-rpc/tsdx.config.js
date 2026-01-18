const path = require('path');

module.exports = {
  rollup(config, options) {
    // 对于 ESM 格式，强制打包 @x-oasis/* 依赖
    if (options.format === 'esm') {
      // tsdx 默认会将 dependencies 标记为 external
      // 我们需要覆盖这个行为，让 @x-oasis/* 包被打包
      const originalExternal = config.external;

      // 创建一个新的 external 函数
      config.external = (id) => {
        // 如果是 @x-oasis/* 包，不标记为 external，让它被打包
        if (id.startsWith('@x-oasis/')) {
          return false;
        }

        // 对于其他依赖，使用原始 external 逻辑
        if (typeof originalExternal === 'function') {
          return originalExternal(id);
        }
        if (Array.isArray(originalExternal)) {
          return originalExternal.includes(id);
        }
        // 如果没有原始配置，默认 external（保持 tsdx 的默认行为）
        // 但这里我们需要检查是否是 node_modules 中的包
        // 如果是 node_modules 中的包且不是 @x-oasis/*，则 external
        if (id.startsWith('.') || id.startsWith('/')) {
          return false; // 相对路径不 external
        }
        return true; // node_modules 中的其他包保持 external
      };

      // 确保 node-resolve 插件能正确解析 workspace 依赖
      // 查找并更新 node-resolve 插件配置
      if (config.plugins) {
        const nodeResolveIndex = config.plugins.findIndex(
          (plugin) =>
            plugin &&
            (plugin.name === 'node-resolve' ||
              plugin.name === '@rollup/plugin-node-resolve')
        );

        if (nodeResolveIndex >= 0) {
          const nodeResolvePlugin = config.plugins[nodeResolveIndex];
          // 更新插件配置，确保能解析 workspace 依赖
          // 如果插件有 resolveId 方法，我们需要确保它能处理 @x-oasis/* 包
          const originalResolveId = nodeResolvePlugin.resolveId;
          if (originalResolveId) {
            nodeResolvePlugin.resolveId = async function (id, importer) {
              // 如果是 @x-oasis/* 包，尝试解析
              if (id.startsWith('@x-oasis/')) {
                const packageName = id.replace('@x-oasis/', '');
                const workspaceRoot = path.resolve(__dirname, '../../../');

                // 尝试从 workspace 包中解析
                const possiblePaths = [
                  // 尝试 dist 目录中的 ESM 文件
                  path.join(
                    workspaceRoot,
                    'packages',
                    packageName.split('/')[0] || '',
                    packageName.split('/')[1] || packageName,
                    'dist',
                    `${packageName.split('/').pop()}.esm.js`
                  ),
                  // 尝试通用的 dist 目录
                  path.join(
                    workspaceRoot,
                    'packages',
                    packageName.split('/')[0] || '',
                    packageName.split('/')[1] || packageName,
                    'dist',
                    'index.esm.js'
                  ),
                ];

                for (const possiblePath of possiblePaths) {
                  try {
                    const fs = require('fs');
                    if (fs.existsSync(possiblePath)) {
                      return path.resolve(possiblePath);
                    }
                  } catch (e) {
                    // 继续尝试
                  }
                }
              }

              // 使用原始的 resolveId
              return originalResolveId.call(this, id, importer);
            };
          }
        }
      }
    }
    return config;
  },
};
