# 提示詞配置文件說明

## 文件結構

```
src/config/prompts/
├── index.ts                  # 統一導出文件
├── systemPromptRules.ts      # 系統提示詞規則
└── userGuidedRules.ts        # 用戶引導規則
```

## 文件說明

### index.ts
- 統一導出所有提示詞規則
- 作爲其他模塊導入的入口點

### systemPromptRules.ts
- 包含完整的精英提示詞工程指南
- 基於《Architecting Intelligence》的系統提示詞規則
- 導出 `SYSTEM_PROMPT_RULES` 常量

### userGuidedRules.ts  
- AI需求收集助手的提示詞規則
- 用於引導用戶有效描述AI自動化需求
- 包含輸入驗證和對話控制邏輯
- 導出 `USER_GUIDED_PROMPT_RULES` 常量

## 擴展指南

### 添加新的AI助手類型

1. 在 `prompts/` 目錄下創建新的規則文件，例如 `codeReviewRules.ts`
2. 導出相應的常量，例如 `CODE_REVIEW_PROMPT_RULES`
3. 在 `index.ts` 中添加導出

示例：

```typescript
// prompts/codeReviewRules.ts
export const CODE_REVIEW_PROMPT_RULES = `你是一個專業的代碼審查助手...`

// prompts/index.ts
import { CODE_REVIEW_PROMPT_RULES } from './codeReviewRules'

export {
  SYSTEM_PROMPT_RULES,
  USER_GUIDED_PROMPT_RULES,
  CODE_REVIEW_PROMPT_RULES  // 新增導出
}
```

### 修改現有規則

1. 直接編輯對應的規則文件
2. 保存後會自動應用到系統中
3. 用戶在設置界面中的自定義會覆蓋默認值

## 命名規範

- 所有常量使用 `UPPER_SNAKE_CASE` 命名
- 文件名使用 `camelCase` 命名，以 `Rules.ts` 結尾
- 導出的常量名應該以 `_RULES` 結尾，例如：
  - `SYSTEM_PROMPT_RULES`
  - `USER_GUIDED_PROMPT_RULES`
  - `CODE_REVIEW_PROMPT_RULES`