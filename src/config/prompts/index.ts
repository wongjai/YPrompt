// 提示词规则统一导出
// 从各个独立文件中导入并导出所有提示词规则

import { SYSTEM_PROMPT_RULES } from './systemPromptRules'
import { USER_GUIDED_PROMPT_RULES } from './userGuidedRules'
import { REQUIREMENT_REPORT_RULES } from './requirementReportRules'

// 导出所有提示词规则
export {
  SYSTEM_PROMPT_RULES,
  USER_GUIDED_PROMPT_RULES,
  REQUIREMENT_REPORT_RULES
}