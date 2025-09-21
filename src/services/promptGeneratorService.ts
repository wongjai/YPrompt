import { AIService } from './aiService'
import type { ProviderConfig } from '@/stores/settingsStore'
import { promptConfigManager } from '@/config/prompts'

export class PromptGeneratorService {
  private static instance: PromptGeneratorService
  private aiService: AIService

  private constructor() {
    this.aiService = AIService.getInstance()
  }

  public static getInstance(): PromptGeneratorService {
    if (!PromptGeneratorService.instance) {
      PromptGeneratorService.instance = new PromptGeneratorService()
    }
    return PromptGeneratorService.instance
  }

  // 格式化变量为提示词部分
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

  // 获取流式模式设置（与ChatInterface保持同步）
  private getStreamMode(): boolean {
    try {
      const savedStreamMode = localStorage.getItem('yprompt_stream_mode')
      return savedStreamMode ? JSON.parse(savedStreamMode) : true // 默认为true
    } catch (error) {
      console.error('Failed to parse stream mode setting:', error)
      return true // 默认为流式模式
    }
  }

  // 获取系统提示词关键指令
  public async getSystemPromptThinkingPoints(
    description: string,
    model: string,
    language: string,
    variables: string[],
    provider?: ProviderConfig,
    onStreamUpdate?: (content: string) => void
  ): Promise<string[]> {
    // 使用内置的系统提示词规则
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
      content: '你是专业的AI提示词工程顾问，专门分析用户需求并提供关键指令建议。'
    }

    const userMessage = {
      role: 'user' as const,
      content: masterPrompt
    }

    if (!provider) {
      throw new Error('请先配置AI提供商')
    }

    const streamMode = this.getStreamMode()
    
    // 如果有流式回调且启用流式模式，设置流式更新
    if (onStreamUpdate && streamMode) {
      this.aiService.setStreamUpdateCallback((chunk: string) => {
        onStreamUpdate(chunk)
      })
    }
    
    const response = await this.aiService.callAI([systemMessage, userMessage], provider, model, streamMode)
    
    // 清理流式回调
    if (onStreamUpdate && streamMode) {
      this.aiService.clearStreamUpdateCallback()
    }
    
    // 解析结果
    const points = response
      .split('\n')
      .map(s => s.replace(/^[*-]\s*/, '').trim())
      .filter(Boolean)
    
    return points
  }

  // 生成系统提示词
  public async generateSystemPrompt(
    description: string,
    model: string,
    language: string,
    variables: string[],
    thinkingPoints?: string[],
    provider?: ProviderConfig,
    onStreamUpdate?: (content: string) => void
  ): Promise<string> {
    // 使用内置的系统提示词规则
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

# Role: 【一句话角色定位】

## Profile
- Author: YPrompt
- Version: 1.0
- Language: ${language === 'zh' ? '中文' : 'English'}
- Description: 【一句话描述该 AI 的职责与能力】

## Skills
1. 【技能 1】
2. 【技能 2】
3. 【技能 3】

## Goal
【用一句话说明本次交互要达成的目标】

## Rules
1. 【必须遵守的规则 1】
2. 【必须遵守的规则 2】
3. 【绝不能做的事】

## Workflow
1. 让用户以"【输入格式】"提供信息
2. 按【处理步骤】输出结果
3. 自检是否符合 Rules，若不符则立即修正

## Output Format
【明确给出最终输出的结构、字数、语言风格、是否使用表格/代码块等】

## Example
【给出一个理想输出示例，或好/坏对比例子】

## Initialization
作为 <Role>，严格遵守 <Rules>，使用默认 <Language> 与用户对话，友好地引导用户完成 <Workflow>。

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
      content: '你是专业的AI提示词工程师，专门基于用户需求生成高质量的系统提示词。'
    }

    const userMessage = {
      role: 'user' as const,
      content: masterPrompt
    }

    if (!provider) {
      throw new Error('请先配置AI提供商')
    }

    const streamMode = this.getStreamMode()
    
    // 如果有流式回调且启用流式模式，设置流式更新
    if (onStreamUpdate && streamMode) {
      this.aiService.setStreamUpdateCallback((chunk: string) => {
        onStreamUpdate(chunk)
      })
    }
    
    const response = await this.aiService.callAI([systemMessage, userMessage], provider, model, streamMode)
    
    // 清理流式回调
    if (onStreamUpdate && streamMode) {
      this.aiService.clearStreamUpdateCallback()
    }
    
    // 清理markdown格式
    return response.replace(/```/g, '').trim()
  }

  // 获取优化建议
  public async getOptimizationAdvice(
    promptToAnalyze: string,
    promptType: 'system' | 'user',
    model: string,
    language: string,
    variables: string[],
    provider?: ProviderConfig,
    onStreamUpdate?: (content: string) => void
  ): Promise<string[]> {
    // 使用内置的系统提示词规则
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
      content: '你是专业的AI提示词优化顾问，专门分析提示词并提供改进建议。'
    }

    const userMessage = {
      role: 'user' as const,
      content: masterPrompt
    }

    if (!provider) {
      throw new Error('请先配置AI提供商')
    }

    const streamMode = this.getStreamMode()
    
    // 如果有流式回调且启用流式模式，设置流式更新
    if (onStreamUpdate && streamMode) {
      this.aiService.setStreamUpdateCallback((chunk: string) => {
        onStreamUpdate(chunk)
      })
    }
    
    const response = await this.aiService.callAI([systemMessage, userMessage], provider, model, streamMode)
    
    // 清理流式回调
    if (onStreamUpdate && streamMode) {
      this.aiService.clearStreamUpdateCallback()
    }
    
    // 解析结果
    const advice = response
      .split('\n')
      .map(s => s.replace(/^[*-]\s*/, '').trim())
      .filter(Boolean)
    
    return advice
  }

  // 应用优化建议
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
    // 使用内置的系统提示词规则
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

# Role: 【优化后的角色定位】

## Profile
- Author: YPrompt
- Version: 1.0
- Language: ${language === 'zh' ? '中文' : 'English'}
- Description: 【优化后的描述】

## Skills
【优化后的技能列表】

## Goal
【优化后的目标】

## Rules
【优化后的规则】

## Workflow
【优化后的工作流程】

## Output Format
【优化后的输出格式】

## Example
【优化后的示例】

## Initialization
【优化后的初始化指令】

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
      content: '你是专业的AI提示词工程师，专门根据建议优化和改进提示词。'
    }

    const userMessage = {
      role: 'user' as const,
      content: masterPrompt
    }

    if (!provider) {
      throw new Error('请先配置AI提供商')
    }

    const streamMode = this.getStreamMode()
    
    // 如果有流式回调且启用流式模式，设置流式更新
    if (onStreamUpdate && streamMode) {
      this.aiService.setStreamUpdateCallback((chunk: string) => {
        onStreamUpdate(chunk)
      })
    }
    
    const response = await this.aiService.callAI([systemMessage, userMessage], provider, model, streamMode)
    
    // 清理流式回调
    if (onStreamUpdate && streamMode) {
      this.aiService.clearStreamUpdateCallback()
    }
    
    // 清理markdown格式
    return response.replace(/```/g, '').trim()
  }
}