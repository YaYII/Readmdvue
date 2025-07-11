/**
 * 智能代码块类型分析器
 * 用于判断代码块应该渲染为图表还是显示为代码
 */

export interface CodeBlockAnalysis {
  /** 是否应该渲染为图表 */
  shouldRenderAsChart: boolean
  /** 代码块类型 */
  type: string
  /** 置信度 (0-1) */
  confidence: number
  /** 分析原因 */
  reason: string
  /** 如果是图表，使用的渲染器类型 */
  chartRenderer?: 'kroki' | 'mermaid' | 'local'
  /** 检测到的图表特征 */
  features: string[]
}

export class CodeBlockAnalyzer {
  // Kroki支持的图表类型
  private static readonly KROKI_CHART_TYPES = [
    'plantuml', 'graphviz', 'blockdiag', 'seqdiag', 'actdiag', 
    'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml', 'ditaa', 
    'erd', 'excalidraw', 'nomnoml', 'svgbob', 'vega', 'vegalite', 
    'wavedrom', 'wireviz', 'structurizr'
  ]

  // Mermaid图表类型
  private static readonly MERMAID_CHART_TYPES = ['mermaid']

  // 编程语言类型（应该显示为代码）
  private static readonly PROGRAMMING_LANGUAGES = [
    'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java', 
    'c', 'cpp', 'c++', 'csharp', 'c#', 'go', 'rust', 'php', 'ruby', 
    'swift', 'kotlin', 'scala', 'html', 'css', 'scss', 'sass', 'less',
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'sql', 'bash', 'sh',
    'powershell', 'cmd', 'dockerfile', 'makefile', 'cmake', 'gradle',
    'maven', 'npm', 'yarn', 'pip', 'conda', 'r', 'matlab', 'octave',
    'lua', 'perl', 'haskell', 'erlang', 'elixir', 'clojure', 'scheme',
    'lisp', 'fortran', 'cobol', 'assembly', 'asm', 'vhdl', 'verilog'
  ]

  // 图表内容特征模式
  private static readonly CHART_PATTERNS = {
    // PlantUML特征
    plantuml: [
      /@startuml|@enduml/i,
      /participant|actor|boundary|control|entity|database/i,
      /class\s+\w+|interface\s+\w+/i,
      /\w+\s*-->\s*\w+|\w+\s*->\s*\w+/i,
      /note\s+(left|right|over|top|bottom)/i,
      /skinparam|!theme|!include/i
    ],
    
    // Mermaid特征
    mermaid: [
      /graph\s+(TD|TB|BT|RL|LR)|flowchart\s+(TD|TB|BT|RL|LR)/i,
      /sequenceDiagram|classDiagram|stateDiagram|erDiagram/i,
      /gantt|pie\s+title|gitgraph/i,
      /\w+\s*-->\s*\w+|\w+\s*->\s*\w+/i,
      /participant\s+\w+|Note\s+(left|right|over)/i
    ],
    
    // Graphviz特征
    graphviz: [
      /digraph\s+\w+|graph\s+\w+/i,
      /\w+\s*->\s*\w+|\w+\s*--\s*\w+/i,
      /node\s*\[|edge\s*\[/i,
      /rankdir\s*=|splines\s*=/i,
      /subgraph\s+\w+/i
    ],
    
    // 其他图表类型的通用特征
    generic: [
      /\w+\s*->\s*\w+|\w+\s*-->\s*\w+/i, // 箭头连接
      /\|\s*\w+\s*\|/i, // 表格式结构
      /\[\w+\]|\(\w+\)/i, // 节点标记
      /start|end|begin|finish/i, // 流程关键词
    ]
  }

  /**
   * 分析代码块类型
   */
  static analyze(language: string, content: string): CodeBlockAnalysis {
    const normalizedLang = language.toLowerCase().trim()
    const trimmedContent = content.trim()

    // 1. 首先检查是否为明确的图表类型
    if (this.isExplicitChartType(normalizedLang)) {
      return this.analyzeExplicitChart(normalizedLang, trimmedContent)
    }

    // 2. 检查是否为明确的编程语言
    if (this.isProgrammingLanguage(normalizedLang)) {
      return this.analyzeProgrammingLanguage(normalizedLang, trimmedContent)
    }

    // 3. 对于未知类型，进行内容分析
    return this.analyzeUnknownType(normalizedLang, trimmedContent)
  }

  /**
   * 检查是否为明确的图表类型
   */
  private static isExplicitChartType(language: string): boolean {
    return [...this.KROKI_CHART_TYPES, ...this.MERMAID_CHART_TYPES].includes(language)
  }

  /**
   * 检查是否为编程语言
   */
  private static isProgrammingLanguage(language: string): boolean {
    return this.PROGRAMMING_LANGUAGES.includes(language)
  }

  /**
   * 分析明确的图表类型
   */
  private static analyzeExplicitChart(language: string, content: string): CodeBlockAnalysis {
    const features = this.detectChartFeatures(language, content)
    const confidence = this.calculateChartConfidence(language, content, features)
    
    // 如果内容看起来不像图表，降低置信度
    if (confidence < 0.3) {
      return {
        shouldRenderAsChart: false,
        type: language,
        confidence: 1 - confidence,
        reason: `虽然标记为${language}，但内容不符合图表特征，作为代码显示`,
        features: [],
      }
    }

    const chartRenderer = this.MERMAID_CHART_TYPES.includes(language) ? 'mermaid' : 'kroki'
    
    return {
      shouldRenderAsChart: true,
      type: language,
      confidence,
      reason: `明确标记为${language}图表类型`,
      chartRenderer,
      features
    }
  }

  /**
   * 分析编程语言代码块
   */
  private static analyzeProgrammingLanguage(language: string, content: string): CodeBlockAnalysis {
    // 检查是否意外包含图表内容
    const chartFeatures = this.detectChartFeatures('generic', content)
    
    if (chartFeatures.length > 2) {
      return {
        shouldRenderAsChart: false,
        type: language,
        confidence: 0.8,
        reason: `标记为${language}编程语言，但可能包含图表内容。建议检查语言标记是否正确`,
        features: chartFeatures
      }
    }

    return {
      shouldRenderAsChart: false,
      type: language,
      confidence: 0.95,
      reason: `明确标记为${language}编程语言`,
      features: []
    }
  }

  /**
   * 分析未知类型
   */
  private static analyzeUnknownType(language: string, content: string): CodeBlockAnalysis {
    const chartFeatures = this.detectChartFeatures('generic', content)
    const chartConfidence = this.calculateGenericChartConfidence(content, chartFeatures)
    
    // 尝试推断可能的图表类型
    const inferredType = this.inferChartType(content)
    
    if (chartConfidence > 0.6) {
      return {
        shouldRenderAsChart: true,
        type: inferredType || language,
        confidence: chartConfidence,
        reason: `未知类型"${language}"，但内容特征表明可能是图表`,
        chartRenderer: inferredType === 'mermaid' ? 'mermaid' : 'kroki',
        features: chartFeatures
      }
    }

    return {
      shouldRenderAsChart: false,
      type: language,
      confidence: 1 - chartConfidence,
      reason: `未知类型"${language}"，内容不符合图表特征，作为代码显示`,
      features: chartFeatures
    }
  }

  /**
   * 检测图表特征
   */
  private static detectChartFeatures(chartType: string, content: string): string[] {
    const features: string[] = []
    const patterns = this.CHART_PATTERNS[chartType as keyof typeof this.CHART_PATTERNS] || 
                    this.CHART_PATTERNS.generic

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        features.push(pattern.source)
      }
    }

    // 检查其他图表类型的特征
    if (chartType === 'generic') {
      for (const [type, typePatterns] of Object.entries(this.CHART_PATTERNS)) {
        if (type === 'generic') continue
        for (const pattern of typePatterns) {
          if (pattern.test(content)) {
            features.push(`${type}:${pattern.source}`)
          }
        }
      }
    }

    return features
  }

  /**
   * 计算图表置信度
   */
  private static calculateChartConfidence(chartType: string, content: string, features: string[]): number {
    const baseConfidence = 0.7 // 明确标记的基础置信度
    const featureBonus = Math.min(features.length * 0.1, 0.3) // 特征加成
    
    // 内容长度影响
    const lengthFactor = content.length > 10 ? 0.1 : -0.2
    
    // 特定类型的额外检查
    let typeSpecificBonus = 0
    if (chartType === 'mermaid' && /graph|flowchart|sequenceDiagram/i.test(content)) {
      typeSpecificBonus = 0.2
    } else if (chartType === 'plantuml' && /@start|@end/i.test(content)) {
      typeSpecificBonus = 0.2
    }

    return Math.min(Math.max(baseConfidence + featureBonus + lengthFactor + typeSpecificBonus, 0), 1)
  }

  /**
   * 计算通用图表置信度
   */
  private static calculateGenericChartConfidence(content: string, features: string[]): number {
    if (features.length === 0) return 0
    
    const featureScore = Math.min(features.length * 0.2, 0.8)
    const lengthBonus = content.length > 20 ? 0.1 : 0
    const structureBonus = this.hasGraphStructure(content) ? 0.2 : 0
    
    return Math.min(featureScore + lengthBonus + structureBonus, 1)
  }

  /**
   * 推断图表类型
   */
  private static inferChartType(content: string): string | null {
    // 检查Mermaid特征
    if (/graph|flowchart|sequenceDiagram|classDiagram/i.test(content)) {
      return 'mermaid'
    }
    
    // 检查PlantUML特征
    if (/@start|@end|participant|actor/i.test(content)) {
      return 'plantuml'
    }
    
    // 检查Graphviz特征
    if (/digraph|graph.*{|node\s*\[/i.test(content)) {
      return 'graphviz'
    }
    
    return null
  }

  /**
   * 检查是否具有图形结构
   */
  private static hasGraphStructure(content: string): boolean {
    // 检查是否有节点连接模式
    const connectionPatterns = [
      /\w+\s*->\s*\w+/g,
      /\w+\s*-->\s*\w+/g,
      /\w+\s*--\s*\w+/g,
      /\w+\s*\|\s*\w+/g
    ]
    
    let connectionCount = 0
    for (const pattern of connectionPatterns) {
      const matches = content.match(pattern)
      if (matches) connectionCount += matches.length
    }
    
    return connectionCount >= 2
  }

  /**
   * 获取建议的处理方式
   */
  static getRecommendation(analysis: CodeBlockAnalysis): string {
    if (analysis.shouldRenderAsChart) {
      return `建议渲染为${analysis.chartRenderer}图表 (置信度: ${(analysis.confidence * 100).toFixed(1)}%)`
    } else {
      return `建议显示为${analysis.type}代码 (置信度: ${(analysis.confidence * 100).toFixed(1)}%)`
    }
  }
}