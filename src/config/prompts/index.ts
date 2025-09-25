// 提示詞規則統一導出
// 從各個獨立文件中導入並導出所有提示詞規則

import { SYSTEM_PROMPT_RULES } from './systemPromptRules'
import { USER_GUIDED_PROMPT_RULES } from './userGuidedRules'
import { REQUIREMENT_REPORT_RULES } from './requirementReportRules'

// 導出所有提示詞規則
export {
  SYSTEM_PROMPT_RULES,
  USER_GUIDED_PROMPT_RULES,
  REQUIREMENT_REPORT_RULES
}