// 內置系統提示詞配置
// 保持獨立性，便於修改和維護
// 提示詞規則已拆分到 prompts/ 目錄下的獨立文件中

import { 
  SYSTEM_PROMPT_RULES, 
  USER_GUIDED_PROMPT_RULES,
  REQUIREMENT_REPORT_RULES
} from './prompts/index'

export interface PromptConfig {
  systemPromptRules: string
  userGuidedPromptRules: string
  requirementReportRules: string
}

// 提示詞配置管理類
export class PromptConfigManager {
  private static instance: PromptConfigManager
  private config: PromptConfig
  
  private function Object() { [native code] }() {
    this.config = {
      systemPromptRules: SYSTEM_PROMPT_RULES,
      userGuidedPromptRules: USER_GUIDED_PROMPT_RULES,
      requirementReportRules: REQUIREMENT_REPORT_RULES
    }
    this.loadFromStorage()
  }

  public static getInstance(): PromptConfigManager {
    if (!PromptConfigManager.instance) {
      PromptConfigManager.instance = new PromptConfigManager()
    }
    return PromptConfigManager.instance
  }

  public getSystemPromptRules(): string {
    return this.config.systemPromptRules
  }

  public getUserGuidedPromptRules(): string {
    return this.config.userGuidedPromptRules
  }

  public updateSystemPromptRules(rules: string): void {
    this.config.systemPromptRules = rules
    this.saveToStorage()
  }

  public updateUserGuidedPromptRules(rules: string): void {
    this.config.userGuidedPromptRules = rules
    this.saveToStorage()
  }

  public getRequirementReportRules(): string {
    return this.config.requirementReportRules
  }

  public updateRequirementReportRules(rules: string): void {
    this.config.requirementReportRules = rules
    this.saveToStorage()
  }

  public resetToDefaults(): void {
    this.config.systemPromptRules = SYSTEM_PROMPT_RULES
    this.config.userGuidedPromptRules = USER_GUIDED_PROMPT_RULES
    this.config.requirementReportRules = REQUIREMENT_REPORT_RULES
    this.saveToStorage()
  }

  // 重置系統提示詞規則爲默認值
  public resetSystemPromptRules(): void {
    this.config.systemPromptRules = SYSTEM_PROMPT_RULES
    this.saveToStorage()
  }

  // 重置用戶引導規則爲默認值
  public resetUserGuidedPromptRules(): void {
    this.config.userGuidedPromptRules = USER_GUIDED_PROMPT_RULES
    this.saveToStorage()
  }

  // 重置需求報告規則爲默認值
  public resetRequirementReportRules(): void {
    this.config.requirementReportRules = REQUIREMENT_REPORT_RULES
    this.saveToStorage()
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('yprompt_config', JSON.stringify(this.config))
    } catch (error) {
      console.error('Failed to save prompt config to localStorage:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('yprompt_config')
      if (saved) {
        const parsed = JSON.parse(saved)
        // 只加載用戶自定義的內容，如果不存在則使用默認值
        this.config.systemPromptRules = parsed.systemPromptRules || SYSTEM_PROMPT_RULES
        this.config.userGuidedPromptRules = parsed.userGuidedPromptRules || USER_GUIDED_PROMPT_RULES
        this.config.requirementReportRules = parsed.requirementReportRules || REQUIREMENT_REPORT_RULES
      }
    } catch (error) {
      // 加載失敗時使用默認配置
      this.config = {
        systemPromptRules: SYSTEM_PROMPT_RULES,
        userGuidedPromptRules: USER_GUIDED_PROMPT_RULES,
        requirementReportRules: REQUIREMENT_REPORT_RULES
      }
    }
  }
}

// 單例實例導出
export const promptConfigManager = PromptConfigManager.getInstance()