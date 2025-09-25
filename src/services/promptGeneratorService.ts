import { AIService } from './aiService'
import type { ProviderConfig } from '@/stores/settingsStore'
import { promptConfigManager } from '@/config/prompts'

export class PromptGeneratorService {
  private static instance: PromptGeneratorService
  private aiService: AIService

  private function Object() { [native code] }() {
    this.aiService = AIService.getInstance()
  }

  public static getInstance(): PromptGeneratorService {
    if (!PromptGeneratorService.instance) {
      PromptGeneratorService.instance = new PromptGeneratorService()
    }
    return PromptGeneratorService.instance
  }

  // 格式化變量爲提示詞部分
  private formatVariablesForPrompt(variables: string[]): string {
    if (!variables || variables.length === 0 || variables.every(v => v.trim() === '')) {
      return ''
    }
    const nonEmptyVariables = variables.filter(v => v.trim() !== '')
    if (nonEmptyVariables.length === 0) {
      return ''
    }
    
    return `
---
Variable Integration:
The final prompt must be designed to be used in a programmatic context. As such, it needs to include specific placeholders or variables. You must incorporate the following variables into the generated prompt where it makes logical sense to do so.

Variable List:
${nonEmptyVariables.map(v => `- \`${v}\``).join('\n')}

For example, if a variable is \`{{user_topic}}\`, you might include a sentence like "The user will provide the \`{{user_topic}}\` for you to write about."
---
    `
  }

  // 獲取流式模式設置（與ChatInterface保持同步）
  private getStreamMode(): boolean {
    try {
      const savedStreamMode = localStorage.getItem('yprompt_stream_mode')
      return savedStreamMode ? JSON.parse(savedStreamMode) : true // 默認爲true
    } catch (error) {
      return true // 默認爲流式模式
    }
  }

  // 獲取系統提示詞關鍵指令
  public async getSystemPromptThinkingPoints(
    description: string,
    model: string,
    language: string,
    variables: string[],
    provider?: ProviderConfig,
    onStreamUpdate?: (content: string) => void
  ): Promise<string[]> {
    // 使用內置的系統提示詞規則
    const SYSTEM_PROMPT_RULES = promptConfigManager.getSystemPromptRules()

    const variablesSection = this.formatVariablesForPrompt(variables)

    const masterPrompt = `
I am an expert prompt engineering advisor. My task is to analyze a user's description for an AI persona and provide a concise, actionable list of key points and characteristics that should be included in a high-performance System Prompt. I will base my suggestions on the principles of elite prompt engineering.

---
Here are the principles I will follow (THE GENERATED PROMPT MUST FULLY FOLLOW THIS RULES):
${SYSTEM_PROMPT_RULES}
---
${variablesSection}
User's Description for AI Persona:
---
${description}
---

Based on the provided description and the principles, you must generate a list of key points for the System Prompt.

**CRITICAL Output Instructions:**
- You must generate ONLY a concise, bulleted list of suggestions.
- Each suggestion must be a brief, single point.
- Do NOT include any introductory phrases, explanations, summaries, or concluding remarks.
- The output should be a raw list of points, with each point on a new line, starting with a hyphen or asterisk.
- **You must generate the output in ${language}.**

Key Points for System Prompt:
    `

    const systemMessage = {
      role: 'system' as const,
      content: '你是專業的AI提示詞工程顧問，專門分析用戶需求並提供關鍵指令建議。'
    }

    const userMessage = {
      role: 'user' as const,
      content: masterPrompt
    }

    if (!provider) {
      throw new Error('請先配置AI提供商')
    }

    const streamMode = this.getStreamMode()
    
    // 如果有流式回調且啓用流式模式，設置流式更新
    if (onStreamUpdate && streamMode) {
      this.aiService.setStreamUpdateCallback((chunk: string) => {
        onStreamUpdate(chunk)
      })
    }
    
    const response = await this.aiService.callAI([systemMessage, userMessage], provider, model, streamMode)
    
    // 清理流式回調
    if (onStreamUpdate && streamMode) {
      this.aiService.clearStreamUpdateCallback()
    }
    
    // 解析結果
    const points = response
      .split('\n')
      .map(s => s.replace(/^[*-]\s*/, '').trim())
      .filter(Boolean)
    
    return points
  }

  // 生成系統提示詞
  public async generateSystemPrompt(
    description: string,
    model: string,
    language: string,
    variables: string[],
    thinkingPoints?: string[],
    provider?: ProviderConfig,
    onStreamUpdate?: (content: string) => void
  ): Promise<string> {
    // 使用內置的系統提示詞規則
    const SYSTEM_PROMPT_RULES = promptConfigManager.getSystemPromptRules()

    const variablesSection = this.formatVariablesForPrompt(variables)
    const thinkingPointsSection = (thinkingPoints && thinkingPoints.length > 0 && thinkingPoints.some(p => p.trim() !== ''))
      ? `
---
Key Directives to Incorporate:
You must intelligently integrate the following specific directives into the final System Prompt. These are non-negotiable and should guide the core logic and personality of the AI.

Directives:
${thinkingPoints.filter(p => p.trim() !== '').map(p => `- ${p}`).join('\n')}
---
      `
      : ''

    const masterPrompt = `
I am an expert in AI prompt engineering, specializing in crafting high-performance System Prompts using a standardized Markdown template structure. My task is to take a user's description and key directives, and generate a well-structured System Prompt following the specified template format.

---
Here are the prompt engineering rules I will follow:
${SYSTEM_PROMPT_RULES}
---
${variablesSection}
${thinkingPointsSection}
User's Original Description:
---
${description}
---

**CRITICAL: You must use the following exact Markdown template structure:**

# Role: 【一句話角色定位】

## Profile
- Author: YPrompt
- Version: 1.0
- Language: ${language === 'zh' ? '中文' : 'English'}
- Description: 【一句話描述該 AI 的職責與能力】

## Skills
1. 【技能 1】
2. 【技能 2】
3. 【技能 3】

## Goal
【用一句話說明本次交互要達成的目標】

## Rules
1. 【必須遵守的規則 1】
2. 【必須遵守的規則 2】
3. 【絕不能做的事】

## Workflow
1. 讓用戶以"【輸入格式】"提供信息
2. 按【處理步驟】輸出結果
3. 自檢是否符合 Rules，若不符則立即修正

## Output Format
【明確給出最終輸出的結構、字數、語言風格、是否使用表格/代碼塊等】

## Example
【給出一個理想輸出示例，或好/壞對比例子】

## Initialization
作爲 <Role>，嚴格遵守 <Rules>，使用默認 <Language> 與用戶對話，友好地引導用戶完成 <Workflow>。

**Output Instructions:**
- Replace all 【】 placeholders with specific content based on the user's description and directives
- Ensure each section is filled with relevant, specific information
- Maintain the exact Markdown structure and section headers
- Generate the output in ${language === 'zh' ? '中文' : 'English'}
- Do NOT include markdown code blocks (\`\`\`) around the output

System Prompt:
    `

    const systemMessage = {
      role: 'system' as const,
      content: '你是專業的AI提示詞工程師，專門基於用戶需求生成高質量的系統提示詞。'
    }

    const userMessage = {
      role: 'user' as const,
      content: masterPrompt
    }

    if (!provider) {
      throw new Error('請先配置AI提供商')
    }

    const streamMode = this.getStreamMode()
    
    // 如果有流式回調且啓用流式模式，設置流式更新
    if (onStreamUpdate && streamMode) {
      this.aiService.setStreamUpdateCallback((chunk: string) => {
        onStreamUpdate(chunk)
      })
    }
    
    const response = await this.aiService.callAI([systemMessage, userMessage], provider, model, streamMode)
    
    // 清理流式回調
    if (onStreamUpdate && streamMode) {
      this.aiService.clearStreamUpdateCallback()
    }
    
    // 清理markdown格式
    return response.replace(/```/g, '').trim()
  }

  // 獲取優化建議
  public async getOptimizationAdvice(
    promptToAnalyze: string,
    promptType: 'system' | 'user',
    model: string,
    language: string,
    variables: string[],
    provider?: ProviderConfig,
    onStreamUpdate?: (content: string) => void
  ): Promise<string[]> {
    // 使用內置的系統提示詞規則
    const SYSTEM_PROMPT_RULES = promptConfigManager.getSystemPromptRules()

    const variablesSection = this.formatVariablesForPrompt(variables)

    const masterPrompt = `
I am an expert prompt engineering advisor specializing in standardized Markdown prompt templates. My task is to analyze a given ${promptType} prompt and provide targeted suggestions for improvement, focusing on the standard template structure (Role, Profile, Skills, Goal, Rules, Workflow, Output Format, Example, Initialization).

---
Here are the prompt engineering principles I will follow:
${SYSTEM_PROMPT_RULES}
---
${variablesSection}
${promptType.charAt(0).toUpperCase() + promptType.slice(1)} Prompt to Analyze:
---
${promptToAnalyze}
---

Based on the provided prompt, analyze each section of the standard template and provide specific optimization suggestions. Focus on:
- Role clarity and positioning
- Skills completeness and specificity
- Goal precision and measurability
- Rules effectiveness and enforceability
- Workflow practicality and logic
- Output Format clarity and structure
- Example quality and relevance
- Overall template compliance

**CRITICAL Output Instructions:**
- Generate ONLY a bulleted list of specific, actionable suggestions
- Each suggestion should target a specific section or aspect of the prompt template
- Be concise but specific about what needs improvement
- Do NOT include introductory phrases or explanations
- Start each point with a hyphen or asterisk
- Generate output in ${language}

Optimization Suggestions:
    `

    const systemMessage = {
      role: 'system' as const,
      content: '你是專業的AI提示詞優化顧問，專門分析提示詞並提供改進建議。'
    }

    const userMessage = {
      role: 'user' as const,
      content: masterPrompt
    }

    if (!provider) {
      throw new Error('請先配置AI提供商')
    }

    const streamMode = this.getStreamMode()
    
    // 如果有流式回調且啓用流式模式，設置流式更新
    if (onStreamUpdate && streamMode) {
      this.aiService.setStreamUpdateCallback((chunk: string) => {
        onStreamUpdate(chunk)
      })
    }
    
    const response = await this.aiService.callAI([systemMessage, userMessage], provider, model, streamMode)
    
    // 清理流式回調
    if (onStreamUpdate && streamMode) {
      this.aiService.clearStreamUpdateCallback()
    }
    
    // 解析結果
    const advice = response
      .split('\n')
      .map(s => s.replace(/^[*-]\s*/, '').trim())
      .filter(Boolean)
    
    return advice
  }

  // 應用優化建議
  public async applyOptimizationAdvice(
    originalPrompt: string,
    advice: string[],
    promptType: 'system' | 'user',
    model: string,
    language: string,
    variables: string[],
    provider?: ProviderConfig,
    onStreamUpdate?: (content: string) => void
  ): Promise<string> {
    // 使用內置的系統提示詞規則
    const SYSTEM_PROMPT_RULES = promptConfigManager.getSystemPromptRules()

    const variablesSection = this.formatVariablesForPrompt(variables)
    const adviceSection = advice.map(a => `- ${a}`).join('\n')

    const masterPrompt = `
I am an expert in AI prompt engineering, specializing in optimizing standardized Markdown prompt templates. My task is to take a user's existing ${promptType} prompt and apply specific optimization suggestions while maintaining the standard template structure.

---
Here are the core principles of elite prompt engineering I will follow:
${SYSTEM_PROMPT_RULES}
---
${variablesSection}
I will carefully apply each optimization suggestion to improve the prompt while preserving the standardized Markdown template format (# Role, ## Profile, ## Skills, ## Goal, ## Rules, ## Workflow, ## Output Format, ## Example, ## Initialization).

Original ${promptType.charAt(0).toUpperCase() + promptType.slice(1)} Prompt:
---
${originalPrompt}
---

Optimization Suggestions to Apply:
---
${adviceSection}
---

**CRITICAL: You must maintain the exact Markdown template structure:**

# Role: 【優化後的角色定位】

## Profile
- Author: YPrompt
- Version: 1.0
- Language: ${language === 'zh' ? '中文' : 'English'}
- Description: 【優化後的描述】

## Skills
【優化後的技能列表】

## Goal
【優化後的目標】

## Rules
【優化後的規則】

## Workflow
【優化後的工作流程】

## Output Format
【優化後的輸出格式】

## Example
【優化後的示例】

## Initialization
【優化後的初始化指令】

**Output Instructions:**
- Apply all optimization suggestions while maintaining the template structure
- Improve content quality and specificity in each section
- Keep the exact Markdown formatting and section headers
- Generate output in ${language === 'zh' ? '中文' : 'English'}
- Do NOT include code blocks (\`\`\`) around the output

Refined ${promptType.charAt(0).toUpperCase() + promptType.slice(1)} Prompt:
    `

    const systemMessage = {
      role: 'system' as const,
      content: '你是專業的AI提示詞工程師，專門根據建議優化和改進提示詞。'
    }

    const userMessage = {
      role: 'user' as const,
      content: masterPrompt
    }

    if (!provider) {
      throw new Error('請先配置AI提供商')
    }

    const streamMode = this.getStreamMode()
    
    // 如果有流式回調且啓用流式模式，設置流式更新
    if (onStreamUpdate && streamMode) {
      this.aiService.setStreamUpdateCallback((chunk: string) => {
        onStreamUpdate(chunk)
      })
    }
    
    const response = await this.aiService.callAI([systemMessage, userMessage], provider, model, streamMode)
    
    // 清理流式回調
    if (onStreamUpdate && streamMode) {
      this.aiService.clearStreamUpdateCallback()
    }
    
    // 清理markdown格式
    return response.replace(/```/g, '').trim()
  }
}