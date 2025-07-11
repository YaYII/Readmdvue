/**
 * @file chartProcessor.js
 * @description 图表处理器模块
 * 用于识别Markdown中的文字型图表（如mermaid、kroki等）并转换为图像
 */
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

/**
 * @class ChartProcessor
 * @description 图表处理器类，负责识别和转换文字型图表
 */
class ChartProcessor {
  /**
   * @constructor
   * @param {Object} config - 配置对象
   */
  constructor(config = {}) {
    this.config = config;
    this.chartConfig = config.charts || {
      enabled: true,
      service: 'kroki', // 'kroki' 或 'local'
      kroki_url: 'https://kroki.io',
      output_format: 'png', // 'svg', 'png', 'pdf' - 推荐使用png避免Word转换时文字丢失
      cache_enabled: true,
      cache_dir: './chart_cache',
      timeout: 10000,
      supported_types: [
        'mermaid', 'plantuml', 'graphviz', 'blockdiag', 'seqdiag',
        'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml',
        'ditaa', 'erd', 'excalidraw', 'nomnoml', 'pikchr', 'structurizr',
        'svgbob', 'umlet', 'vega', 'vegalite', 'wavedrom', 'svg'
      ]
    };
    
    // 网络连接状态
    this.networkStatus = {
      isOnline: null,
      lastChecked: null,
      checkInterval: 300000 // 5分钟重新检测一次
    };
    
    // 确保缓存目录存在 - 使用绝对路径避免在VS Code扩展环境中的路径问题
    if (this.chartConfig.cache_enabled) {
      try {
        // 如果是相对路径，转换为基于临时目录的绝对路径
        if (!path.isAbsolute(this.chartConfig.cache_dir)) {
          const os = require('os');
          this.chartConfig.cache_dir = path.join(os.tmpdir(), 'markdown-to-word', 'chart_cache');
        }
        fs.ensureDirSync(this.chartConfig.cache_dir);
        console.log(`📁 图表缓存目录已创建: ${this.chartConfig.cache_dir}`);
      } catch (error) {
        console.warn(`⚠️ 无法创建图表缓存目录: ${error.message}`);
        // 禁用缓存功能
        this.chartConfig.cache_enabled = false;
      }
    }
  }

  /**
   * @method checkNetworkConnectivity
   * @description 检查网络连接状态
   * @returns {Promise<boolean>} - 是否能连接到Kroki服务
   */
  async checkNetworkConnectivity() {
    const now = Date.now();
    
    // 如果最近检查过且在有效期内，返回缓存结果
    if (this.networkStatus.lastChecked && 
        (now - this.networkStatus.lastChecked) < this.networkStatus.checkInterval &&
        this.networkStatus.isOnline !== null) {
      return this.networkStatus.isOnline;
    }

    try {
      console.log('🌐 检查网络连接状态...');
      const response = await axios.get(this.chartConfig.kroki_url, {
        timeout: 5000, // 5秒超时，比图表转换超时短
        validateStatus: function (status) {
          return status < 500; // 接受4xx状态码，只要不是服务器错误
        }
      });
      
      this.networkStatus.isOnline = true;
      this.networkStatus.lastChecked = now;
      console.log('✅ 网络连接正常，可以使用图表转换功能');
      return true;
    } catch (error) {
      this.networkStatus.isOnline = false;
      this.networkStatus.lastChecked = now;
      
      if (error.code === 'ECONNABORTED') {
        console.warn('❌ 网络连接超时，无法连接到Kroki服务');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.warn('❌ 网络连接失败，无法连接到Kroki服务');
      } else {
        console.warn(`❌ 网络检查失败: ${error.message}`);
      }
      
      console.warn('⚠️  图表转换功能将被禁用，如需使用请检查网络连接');
      return false;
    }
  }

  /**
   * @method processCharts
   * @description 处理Markdown内容中的图表代码块
   * @param {string} content - Markdown内容
   * @param {string} outputDir - 输出目录（可选）
   * @returns {Promise<string>} - 处理后的内容
   */
  async processCharts(content, outputDir = null) {
    console.log('图表处理器状态:', this.chartConfig.enabled ? '已启用' : '未启用');
    if (!this.chartConfig.enabled) {
      console.log('图表处理被禁用，跳过处理');
      return content;
    }

    // 检查网络连接状态
    const isNetworkAvailable = await this.checkNetworkConnectivity();
    if (!isNetworkAvailable) {
      // console.warn('⚠️  由于网络连接问题，跳过图表处理');
      // console.warn('💡 提示：可以配置 charts.enabled: false 来禁用图表功能，避免每次检查网络');
      return content;
    }

    try {
      // console.log('🎨 开始处理图表代码块...');
      
      // 识别图表代码块的正则表达式
      const chartRegex = /```(\w+)\s*\n([\s\S]*?)\n```/g;
      let processedContent = content;
      const matches = [];
      let match;

      // 收集所有匹配的图表代码块
      while ((match = chartRegex.exec(content)) !== null) {
        const [fullMatch, language, code] = match;
        if (this.chartConfig.supported_types.includes(language.toLowerCase())) {
          matches.push({
            fullMatch,
            language: language.toLowerCase(),
            code: code.trim(),
            index: match.index
          });
        }
      }

      // console.log(`📊 发现 ${matches.length} 个图表代码块`);

      // 处理每个图表代码块
      for (const chartMatch of matches) {
        try {
          const imageData = await this.convertChartToImage(
            chartMatch.language,
            chartMatch.code,
            outputDir
          );
          
          if (imageData) {
            // 替换原始代码块为图像标签
            const imageTag = this.createImageTag(imageData, chartMatch.language);
            processedContent = processedContent.replace(chartMatch.fullMatch, imageTag);
            // console.log(`✅ 成功转换 ${chartMatch.language} 图表`);
          }
        } catch (error) {
          console.error(`图表渲染失败 [${chartMatch.language}]:`, error);
          
          // PlantUML 特定错误处理
          if (error.response?.status === 400 && (chartMatch.language === 'plantuml' || chartMatch.language === 'puml')) {
            console.error('PlantUML 语法错误，可能的原因：');
            console.error('1. 缺少 @startuml/@enduml 包装');
            console.error('2. 语法错误或不支持的元素');
            console.error('3. 编码问题');
          }
          
          // Mermaid 特定错误处理
          if (error.response?.status === 400 && chartMatch.language === 'mermaid') {
            console.error('Mermaid 语法错误，可能的原因：');
            console.error('1. 中文字符未正确引用（需要用双引号包围）');
            console.error('2. 缺少图表类型声明（如 flowchart TD）');
            console.error('3. 节点名称包含特殊字符未转义');
            console.error('4. 箭头语法错误或连接线格式问题');
            console.error('5. 图表结构不完整或语法不规范');
            console.error('💡 中文节点应格式化为: A["中文文本"] 或 "中文节点" --> "其他节点"');
          }
          
          // 记录详细错误信息
          const errorDetails = {
            type: chartMatch.language,
            code: chartMatch.code.substring(0, 100) + '...',
            error: error.message,
            stack: error.stack
          };
          console.error('详细错误信息:', errorDetails);
          
          // 保留原始代码块
        }
      }

      return processedContent;
    } catch (error) {
      // console.error('❌ 图表处理过程中发生错误:', error);
      return content; // 返回原始内容
    }
  }

  /**
   * @method convertChartToImage
   * @description 将图表代码转换为图像文件
   * @param {string} chartType - 图表类型
   * @param {string} chartCode - 图表代码
   * @param {string} outputDir - 输出目录
   * @returns {Promise<Object>} - 图像文件信息对象
   */
  async convertChartToImage(chartType, chartCode, outputDir = null) {
    // 确保输出目录存在
    const imagesDir = outputDir ? path.join(outputDir, 'images') : path.join(process.cwd(), 'images');
    await fs.ensureDir(imagesDir);

    // 生成文件名
    const hash = crypto.createHash('md5')
      .update(`${chartType}:${chartCode}`)
      .digest('hex');
    const fileName = `${chartType}_${hash.substring(0, 8)}.${chartType === 'svg' ? 'svg' : this.chartConfig.output_format}`;
    const filePath = path.join(imagesDir, fileName);
    const relativePath = path.join('images', fileName);

    // 检查文件是否已存在
    if (await fs.pathExists(filePath)) {
      // console.log(`📦 使用已存在的 ${chartType} 图表文件: ${fileName}`);
      return {
        type: 'file',
        filePath: filePath,
        relativePath: relativePath,
        fileName: fileName,
        format: chartType === 'svg' ? 'svg' : this.chartConfig.output_format
      };
    }

    // 特殊处理SVG类型 - 直接保存为SVG文件
    if (chartType === 'svg') {
      // console.log('🎨 处理SVG代码块，保存为SVG文件');
      await fs.writeFile(filePath, chartCode.trim(), 'utf8');
      // console.log(`💾 SVG文件已保存: ${fileName}`);
      return {
        type: 'file',
        filePath: filePath,
        relativePath: relativePath,
        fileName: fileName,
        format: 'svg'
      };
    }

    // 生成缓存键（用于API调用的缓存）
    const cacheKey = this.generateCacheKey(chartType, chartCode);
    
    // 检查API调用缓存
    if (this.chartConfig.cache_enabled) {
      const cachedImage = await this.getCachedImage(cacheKey);
      if (cachedImage) {
        // console.log(`📦 使用缓存的 ${chartType} 图表数据`);
        // 将缓存数据保存为文件
        await fs.writeFile(filePath, cachedImage.data, 
          this.chartConfig.output_format === 'svg' ? 'utf8' : null);
        // console.log(`💾 图表文件已保存: ${fileName}`);
        return {
          type: 'file',
          filePath: filePath,
          relativePath: relativePath,
          fileName: fileName,
          format: this.chartConfig.output_format
        };
      }
    }

    // 调用Kroki API转换图表
    const imageData = await this.callKrokiAPI(chartType, chartCode);
    
    if (imageData) {
      // 保存图片文件
      await fs.writeFile(filePath, imageData.data, 
        this.chartConfig.output_format === 'svg' ? 'utf8' : null);
      // console.log(`💾 图表文件已保存: ${fileName}`);
      
      // 缓存API调用结果
      if (this.chartConfig.cache_enabled) {
        await this.cacheImage(cacheKey, imageData);
      }

      return {
        type: 'file',
        filePath: filePath,
        relativePath: relativePath,
        fileName: fileName,
        format: this.chartConfig.output_format
      };
    }

    throw new Error(`Failed to convert ${chartType} chart`);
  }

  /**
   * @method callKrokiAPI
   * @description 调用Kroki API转换图表
   * @param {string} chartType - 图表类型
   * @param {string} chartCode - 图表代码
   * @returns {Promise<Object>} - 图像数据
   */
  async callKrokiAPI(chartType, chartCode) {
    try {
      const url = `${this.chartConfig.kroki_url}/${chartType}/${this.chartConfig.output_format}`;
      
      // console.log(`🌐 调用Kroki API: ${chartType} -> ${this.chartConfig.output_format}`);
      
      // 根据Kroki官方文档，使用正确的API调用方式
      // 直接发送纯文本代码（推荐方式）
      const response = await axios.post(url, chartCode, {
        headers: {
          'Content-Type': 'text/plain',
          'Accept': this.chartConfig.output_format === 'svg' ? 'image/svg+xml' : `image/${this.chartConfig.output_format}`
        },
        timeout: this.chartConfig.timeout,
        responseType: this.chartConfig.output_format === 'svg' ? 'text' : 'arraybuffer'
      });

      if (response.status === 200) {
        return {
          format: this.chartConfig.output_format,
          data: response.data,
          mimeType: this.getMimeType(this.chartConfig.output_format)
        };
      } else {
        throw new Error(`Kroki API返回错误状态: ${response.status}`);
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Kroki API请求超时');
      } else if (error.response) {
        throw new Error(`Kroki API错误: ${error.response.status} - ${error.response.statusText}`);
      } else {
        throw new Error(`网络错误: ${error.message}`);
      }
    }
  }

  /**
   * @method createImageTag
   * @description 创建图像标签
   * @param {Object} imageData - 图像文件信息
   * @param {string} chartType - 图表类型
   * @returns {string} - HTML图像标签
   */
  createImageTag(imageData, chartType) {
    if (imageData.type === 'file') {
      // 使用相对路径引用本地图片文件
      const relativePath = imageData.relativePath.replace(/\\/g, '/');
      return `\n<div class="chart-container chart-${chartType}">\n<img src="${relativePath}" alt="${chartType} chart" class="chart-image" />\n</div>\n`;
    } else {
      // 兼容旧格式（如果还有的话）
      console.warn('使用了旧的图像数据格式，建议更新代码');
      if (imageData.format === 'svg') {
        const svgContent = imageData.type === 'svg' ? imageData.content : imageData.data;
        return `\n<div class="chart-container chart-${chartType}">\n${svgContent}\n</div>\n`;
      } else {
        const base64Data = Buffer.from(imageData.data).toString('base64');
        const dataUrl = `data:${imageData.mimeType};base64,${base64Data}`;
        return `\n<div class="chart-container chart-${chartType}">\n<img src="${dataUrl}" alt="${chartType} chart" class="chart-image" />\n</div>\n`;
      }
    }
  }

  /**
   * @method generateCacheKey
   * @description 生成缓存键
   * @param {string} chartType - 图表类型
   * @param {string} chartCode - 图表代码
   * @returns {string} - 缓存键
   */
  generateCacheKey(chartType, chartCode) {
    const hash = crypto.createHash('md5')
      .update(`${chartType}:${chartCode}:${this.chartConfig.output_format}`)
      .digest('hex');
    return `${chartType}_${hash}.${this.chartConfig.output_format}`;
  }

  /**
   * @method getCachedImage
   * @description 获取缓存的图像
   * @param {string} cacheKey - 缓存键
   * @returns {Promise<Object|null>} - 缓存的图像数据或null
   */
  async getCachedImage(cacheKey) {
    try {
      const cachePath = path.join(this.chartConfig.cache_dir, cacheKey);
      const exists = await fs.pathExists(cachePath);
      
      if (exists) {
        const data = await fs.readFile(cachePath, 
          this.chartConfig.output_format === 'svg' ? 'utf8' : null
        );
        return {
          format: this.chartConfig.output_format,
          data: data,
          mimeType: this.getMimeType(this.chartConfig.output_format)
        };
      }
    } catch (error) {
      console.warn('读取缓存失败:', error.message);
    }
    return null;
  }

  /**
   * @method cacheImage
   * @description 缓存图像数据
   * @param {string} cacheKey - 缓存键
   * @param {Object} imageData - 图像数据
   * @returns {Promise<void>}
   */
  async cacheImage(cacheKey, imageData) {
    try {
      const cachePath = path.join(this.chartConfig.cache_dir, cacheKey);
      await fs.writeFile(cachePath, imageData.data, 
        this.chartConfig.output_format === 'svg' ? 'utf8' : null
      );
      console.log(`💾 图表已缓存: ${cacheKey}`);
    } catch (error) {
      console.warn('缓存图表失败:', error.message);
    }
  }

  /**
   * @method getDiagramOptions
   * @description 获取图表选项，用于控制输出质量和尺寸
   * @param {string} chartType - 图表类型
   * @returns {Object} - 图表选项
   */
  getDiagramOptions(chartType) {
    const options = {};
    
    // 为PNG格式设置高质量选项
    if (this.chartConfig.output_format === 'png') {
      // 设置DPI为300，确保高质量输出
      options.dpi = 300;
      
      // 根据图表类型设置特定选项
      switch (chartType.toLowerCase()) {
        case 'mermaid':
          // Mermaid特定选项
          options.theme = 'default';
          options.background = 'white';
          options.width = 1200; // 设置宽度，保持1:1比例
          options.height = 800; // 设置高度
          break;
        case 'plantuml':
        case 'c4plantuml':
          // PlantUML特定选项
          options.scale = 1.0; // 保持原始尺寸比例
          options.dpi = 300;
          break;
        case 'graphviz':
          // GraphViz特定选项
          options.dpi = 300;
          options.size = '10,8'; // 设置图片尺寸（英寸）
          break;
        default:
          // 通用选项
          options.scale = 1.0;
          break;
      }
    } else if (this.chartConfig.output_format === 'svg') {
      // SVG格式选项
      options.background = 'white';
      
      if (chartType.toLowerCase() === 'mermaid') {
        options.theme = 'default';
        options.width = 1200;
        options.height = 800;
      }
    }
    
    console.log(`📊 图表选项 (${chartType}):`, options);
    return options;
  }

  /**
   * @method getMimeType
   * @description 获取MIME类型
   * @param {string} format - 图像格式
   * @returns {string} - MIME类型
   */
  getMimeType(format) {
    const mimeTypes = {
      'svg': 'image/svg+xml',
      'png': 'image/png',
      'pdf': 'application/pdf',
      'jpeg': 'image/jpeg',
      'jpg': 'image/jpeg'
    };
    return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * @method getStats
   * @description 获取处理统计信息
   * @returns {Object} - 统计信息
   */
  getStats() {
    return {
      enabled: this.chartConfig.enabled,
      service: this.chartConfig.service,
      supported_types: this.chartConfig.supported_types,
      cache_enabled: this.chartConfig.cache_enabled,
      output_format: this.chartConfig.output_format
    };
  }
}

module.exports = ChartProcessor;