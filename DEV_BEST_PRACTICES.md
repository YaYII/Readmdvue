# 开发最佳实践 - 减少扩展程序重载频率

## 已实施的优化配置

### 1. Vite配置优化 (`vite.config.ts`)
- ✅ 配置文件监听排除规则
- ✅ 优化HMR（热模块替换）设置
- ✅ 禁用错误覆盖层
- ✅ 增加轮询间隔
- ✅ 优化依赖预构建

### 2. VS Code配置优化 (`.vscode/settings.json`)
- ✅ 排除不必要的文件监听
- ✅ 优化TypeScript自动导入
- ✅ 配置搜索排除规则

## 开发时的最佳实践

### 避免触发重载的操作

1. **避免频繁修改这些文件：**
   - `manifest.json` - 每次修改都会触发完整重载
   - `package.json` - 依赖变更会导致重载
   - `vite.config.ts` - 配置变更需要重启

2. **谨慎编辑以下目录：**
   - `public/` - 静态资源变更可能触发重载
   - `src/background/` - Service Worker变更会重载扩展

3. **推荐的开发流程：**
   ```bash
   # 1. 启动开发服务器
   npm run dev
   
   # 2. 在浏览器中加载扩展程序
   # Chrome -> 扩展程序 -> 开发者模式 -> 加载已解压的扩展程序 -> 选择 dist 文件夹
   
   # 3. 主要编辑这些文件（热重载支持良好）：
   # - src/components/*.vue
   # - src/utils/*.ts (除了background相关)
   # - src/styles/*.css
   # - src/popup/*.vue
   ```

### 调试技巧

1. **使用浏览器开发者工具：**
   ```javascript
   // 在扩展程序的popup或content script中
   console.log('调试信息', data);
   ```

2. **Service Worker调试：**
   - Chrome -> 扩展程序 -> 详情 -> 检查视图 -> Service Worker

3. **减少console.log输出：**
   - 过多的日志输出可能影响性能
   - 使用条件日志：
   ```typescript
   if (__DEV__) {
     console.log('开发环境调试信息');
   }
   ```

### 性能优化建议

1. **代码分割：**
   ```typescript
   // 使用动态导入减少初始包大小
   const heavyModule = await import('./heavyModule');
   ```

2. **避免全局状态频繁更新：**
   ```typescript
   // 使用防抖处理频繁更新
   import { debounce } from '@/utils/configThrottle';
   
   const updateState = debounce((newState) => {
     store.updateState(newState);
   }, 300);
   ```

3. **图表渲染优化：**
   ```typescript
   // 使用缓存避免重复渲染
   if (chartCache.has(chartData)) {
     return chartCache.get(chartData);
   }
   ```

## 故障排除

### 如果仍然频繁重载：

1. **检查文件监听：**
   ```bash
   # 查看哪些文件正在被监听
   lsof +D /path/to/project | grep node
   ```

2. **清理缓存：**
   ```bash
   # 清理node_modules缓存
   rm -rf node_modules/.vite
   npm run dev
   ```

3. **临时禁用HMR：**
   ```typescript
   // 在vite.config.ts中临时禁用
   server: {
     hmr: false // 临时禁用热重载
   }
   ```

### 常见问题解决

1. **端口冲突：**
   ```bash
   # 查找占用端口的进程
   lsof -ti:5173
   lsof -ti:5174
   
   # 杀死进程
   pkill -f "vite"
   ```

2. **内存占用过高：**
   ```typescript
   // 在vite.config.ts中限制内存使用
   optimizeDeps: {
     esbuildOptions: {
       target: 'esnext',
       keepNames: true
     }
   }
   ```

## 监控和诊断

### 性能监控

使用内置的性能监控组件：
```vue
<PerformanceMonitor 
  :enableMetrics="true"
  :trackMemory="true"
/>
```

### 开发时日志

启用详细日志：
```bash
# 设置环境变量
export DEBUG=vite:*
npm run dev
```

---

**注意：** 这些优化主要针对开发环境。生产构建时请使用 `npm run build` 进行最终的性能验证。 