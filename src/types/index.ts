// 核心类型定义
export type Theme = 'light' | 'dark' | 'auto' | 'eyecare'

// 苹果强调色系统
export type AccentColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'graphite'

export interface AccentColorInfo {
  name: string
  displayName: string
  primaryColor: string
  description: string
  category: string
}

export interface MarkdownConfig {
  theme: Theme
  accentColor: AccentColor
  enableMermaid: boolean
  enableCharts: boolean
  enableMath: boolean
  enableHighlight: boolean
  enableTables: boolean
  enableTaskLists: boolean
  fontSize: number
  lineHeight: number
  maxWidth: number
  fontFamily: string
  codeTheme: string
  mathRenderer: 'katex' | 'mathjax'
  tableStyle: 'default' | 'striped' | 'bordered'
  linkTarget: '_blank' | '_self'
  enableImageZoom: boolean
  enableCopyCode: boolean
  enableLineNumbers: boolean
  enableWordWrap: boolean
  enableAutoSave: boolean
  autoSaveInterval: number
}

// 默认配置
export const defaultConfig: MarkdownConfig = {
  theme: 'auto',
  accentColor: 'blue',
  enableMermaid: true,
  enableCharts: true,
  enableMath: true,
  enableHighlight: true,
  enableTables: true,
  enableTaskLists: true,
  fontSize: 16,
  lineHeight: 1.6,
  maxWidth: 800,
  fontFamily: 'PingFang SC, Microsoft YaHei UI, Segoe UI Variable, -apple-system, BlinkMacSystemFont, sans-serif',
  codeTheme: 'github',
  mathRenderer: 'katex',
  tableStyle: 'default',
  linkTarget: '_blank',
  enableImageZoom: true,
  enableCopyCode: true,
  enableLineNumbers: true,
  enableWordWrap: true,
  enableAutoSave: true,
  autoSaveInterval: 5000
}

// 苹果强调色配置
export const accentColors: Record<AccentColor, AccentColorInfo> = {
  blue: {
    name: 'blue',
    displayName: '蓝色',
    primaryColor: '#007AFF',
    description: '默认系统色，用于链接、按钮、选中状态',
    category: 'system'
  },
  purple: {
    name: 'purple',
    displayName: '紫色',
    primaryColor: '#AF52DE',
    description: '用于创意、艺术类功能',
    category: 'creative'
  },
  pink: {
    name: 'pink',
    displayName: '粉色',
    primaryColor: '#FF2D92',
    description: '用于社交、情感类功能',
    category: 'social'
  },
  red: {
    name: 'red',
    displayName: '红色',
    primaryColor: '#FF3B30',
    description: '用于警告、错误、删除操作',
    category: 'alert'
  },
  orange: {
    name: 'orange',
    displayName: '橙色',
    primaryColor: '#FF9500',
    description: '用于提醒、通知、活跃状态',
    category: 'notification'
  },
  yellow: {
    name: 'yellow',
    displayName: '黄色',
    primaryColor: '#FFCC00',
    description: '用于警示、高亮、重要信息',
    category: 'highlight'
  },
  green: {
    name: 'green',
    displayName: '绿色',
    primaryColor: '#30D158',
    description: '用于成功、确认、环保主题',
    category: 'success'
  },
  graphite: {
    name: 'graphite',
    displayName: '石墨色',
    primaryColor: '#8E8E93',
    description: '用于中性、专业、商务场景',
    category: 'neutral'
  }
}

// 图表类型 - 统一通过Kroki支持
export type ChartType = 
  | 'mermaid'
  | 'plantuml' 
  | 'graphviz'
  | 'blockdiag'
  | 'seqdiag'
  | 'actdiag'
  | 'nwdiag'
  | 'packetdiag'
  | 'rackdiag'
  | 'c4plantuml'
  | 'ditaa'
  | 'erd'
  | 'excalidraw'
  | 'nomnoml'
  | 'svgbob'
  | 'vega'
  | 'vegalite'
  | 'wavedrom'
  | 'wireviz'
  | 'structurizr'

export interface ChartConfig {
  type: ChartType
  content: string
  options?: Record<string, any>
}

/**
 * 图表渲染结果接口
 */
export interface ChartRenderResult {
  success: boolean
  content?: string
  error?: string
  renderTime?: number
  fromCache?: boolean
}

/**
 * 渲染结果接口
 */
export interface RenderResult {
  success: boolean
  content?: string
  error?: string
  warnings?: string[]
}

/**
 * 图表渲染管理器接口
 */
export interface ChartRenderManager {
  renderChart(type: string, content: string, element: HTMLElement): Promise<ChartRenderResult>
  renderAllCharts(): Promise<void>
}

// 渲染状态
export interface RenderState {
  isRendering: boolean
  lastRenderTime: number
  renderCount: number
  errors: string[]
}

// 文档信息
export interface DocumentInfo {
  title: string
  url: string
  content: string
  lastModified: number
  wordCount: number
  readingTime: number
  headings: HeadingInfo[]
}

// 标题信息
export interface HeadingInfo {
  level: number
  text: string
  id: string
  position: number
}

// 性能指标
export interface PerformanceMetrics {
  renderTime: number
  averageRenderTime: number
  chartCount: number
  mathCount: number
  imageCount: number
  codeBlockCount: number
  memoryUsage?: number
  peakMemory: number
  domNodes: number
  totalElements: number
  chartsRendered: number
  chartRenderTime: number
  totalRenders: number
  errorCount: number
  cacheHitRate: number
  networkRequests: number
  documentSize: number
  uptime: number
}

export interface PluginState {
  isActive: boolean
  isMarkdownFile: boolean
  config: MarkdownConfig
  lastError: string | null
}

export interface LogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
  data?: any
}

// 浏览器插件消息类型
export interface ExtensionMessage {
  type: 'GET_STATE' | 'UPDATE_CONFIG' | 'UPDATE_STYLE_CONFIG' | 'RENDER_MARKDOWN' | 'LOG_EVENT' | 'PING' | 'EXPORT_HTML' | 'PRINT_PAGE' | 'SEARCH' | 'JUMP_TO_RESULT'
  payload?: any
  config?: MarkdownConfig
  options?: SearchOptions
}

export interface ExtensionResponse {
  success: boolean
  data?: any
  error?: string
}

// 组件Props类型
export interface MarkdownRendererProps {
  content: string
  config: MarkdownConfig
}

export interface SettingsPanelProps {
  config: MarkdownConfig
  onConfigChange: (config: MarkdownConfig) => void
}

// 工具函数类型
export type ThemeMode = 'light' | 'dark' | 'auto'
export type LogLevel = 'info' | 'warn' | 'error'

// 搜索相关类型
export interface SearchResult {
  id: string
  text: string
  index: number
  length: number
  context: string
  highlightedText: string
  line: number
  column: number
  type: string
  element: Element | null
}

export interface SearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  useRegex?: boolean
  searchInHeaders?: boolean
  searchInCode?: boolean
  searchInLinks?: boolean
}

// 导出选项
export interface ExportOptions {
  format: 'html' | 'pdf' | 'markdown' | 'png' | 'jpeg'
  filename: string
  includeStyles: boolean
  includeImages?: boolean
  includeCharts?: boolean
  includeMath?: boolean
  pageSize?: string
  orientation?: 'portrait' | 'landscape'
  quality?: number
}

// 错误类型
export interface RenderError {
  type: 'general' | 'chart' | 'math' | 'syntax'
  message: string
  stack?: string
  timestamp: number
  context?: any
}

export class MarkdownRenderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'MarkdownRenderError'
  }
}

export class ChartRenderError extends Error {
  constructor(
    message: string,
    public readonly chartType: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'ChartRenderError'
  }
}

// 苹果设计系统色彩
export const AppleColors = {
  // 系统色彩
  systemBlue: '#007AFF',
  systemPurple: '#AF52DE',
  systemPink: '#FF2D92',
  systemRed: '#FF3B30',
  systemOrange: '#FF9500',
  systemYellow: '#FFCC00',
  systemGreen: '#30D158',
  systemGraphite: '#8E8E93',
  
  // 中性色彩
  systemGray: '#8E8E93',
  systemGray2: '#AEAEB2',
  systemGray3: '#C7C7CC',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  systemGray6: '#F2F2F7',
  
  // 语义色彩
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C43',
  quaternaryLabel: '#2C2C2E',
  
  // 背景色彩
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7',
  tertiarySystemBackground: '#FFFFFF',
  
  // Liquid Glass 材质
  liquidGlassLight: 'rgba(255, 255, 255, 0.8)',
  liquidGlassDark: 'rgba(0, 0, 0, 0.3)',
  liquidGlassBlur: 'blur(20px)'
} as const

// 动画配置
export interface AnimationConfig {
  duration: {
    fast: number
    normal: number
    slow: number
  }
  easing: {
    ease: string
    easeIn: string
    easeOut: string
    easeInOut: string
  }
  enabled: boolean
}

// 默认动画配置
export const DefaultAnimations: AnimationConfig = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350
  },
  easing: {
    ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.58, 1)',
    easeInOut: 'cubic-bezier(0.42, 0, 0.58, 1)'
  },
  enabled: true
}