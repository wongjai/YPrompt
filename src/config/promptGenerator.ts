/**
 * 提示詞生成器模塊配置
 * 便於將來封裝爲獨立子模塊或集成到更大的項目中
 */

export interface PromptGeneratorConfig {
  // 歡迎消息配置
  welcomeMessage: string
  
  // 快速回複選項
  quickReplies: string[]
  
  // 對話設置
  maxConversationTurns: number
  typingDelay: number
}

// 默認配置
export const DEFAULT_PROMPT_GENERATOR_CONFIG: PromptGeneratorConfig = {
  welcomeMessage: "您好！我是提示詞工程專家，將通過幾個問題幫您構建一個高質量的AI提示詞。請先告訴我：您希望用AI來解決什麼問題或完成什麼任務？",
  
  quickReplies: [
    '請使用相關最佳實踐的推薦建議',
    '強制生成需求報告'
  ],
  
  maxConversationTurns: 5,
  typingDelay: 50
}

// 模塊標識符
export const MODULE_INFO = {
  name: 'PromptGenerator',
  version: '1.0.0',
  description: '智能提示詞生成器',
  author: 'YPrompt Team'
}

// 導出配置獲取函數，便於將來擴展自定義配置
export function getPromptGeneratorConfig(customConfig?: Partial<PromptGeneratorConfig>): PromptGeneratorConfig {
  return {
    ...DEFAULT_PROMPT_GENERATOR_CONFIG,
    ...customConfig
  }
}
