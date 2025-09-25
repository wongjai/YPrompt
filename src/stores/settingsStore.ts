import { defineStore } from 'pinia'
import { ref } from 'vue'
import { promptConfigManager } from '@/config/prompts'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  enabled: boolean
  apiType?: 'openai' | 'anthropic' | 'google' // 模型使用的API类型
  
  // 新增：能力检测相关字段
  capabilities?: ModelCapabilities
  lastTested?: Date
  testStatus?: 'untested' | 'testing' | 'success' | 'failed'
}

export interface ModelCapabilities {
  reasoning: boolean                    // 是否支持思考
  reasoningType: ReasoningType | null   // 思考类型
  supportedParams: SupportedParams     // 支持的API参数
  testResult?: TestResult              // 详细测试结果
}

export type ReasoningType = 
  | 'openai-reasoning'    // OpenAI o1系列
  | 'gemini-thought'      // Gemini thought字段
  | 'claude-thinking'     // Claude thinking标签
  | 'generic-cot'         // 通用链式思考

export interface SupportedParams {
  temperature: boolean                  // 是否支持temperature参数
  maxTokens: 'max_tokens' | 'max_completion_tokens'  // 使用的token参数名
  streaming: boolean                   // 是否支持流式输出
  systemMessage: boolean               // 是否支持系统消息
}

export interface TestResult {
  connected: boolean                   // 基础连接是否成功
  reasoning: boolean                   // 思考能力是否可用
  responseTime: number                // 响应时间(ms)
  error?: string                      // 错误信息
  timestamp: Date                     // 测试时间戳
}

export interface ProviderConfig {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'google' | 'custom'
  apiKey: string
  baseUrl?: string
  models: ModelConfig[]
  enabled: boolean
  allowCustomUrl?: boolean // 是否允许自定义URL
}

export const useSettingsStore = defineStore('settings', () => {
  const showSettings = ref(false)
  const providers = ref<ProviderConfig[]>([])
  const selectedProvider = ref<string>('')
  const selectedModel = ref<string>('')
  const streamMode = ref(true) // 默认开启流式模式

  // 提示词编辑相关状态
  const showPromptEditor = ref(false)
  const editingPromptType = ref<'system' | 'user'>('system')
  const editingSystemRules = ref('')
  const editingUserRules = ref('')
  const editingRequirementReportRules = ref('')

  // 初始化默认配置
  const initializeDefaults = () => {
    // 不再预设空的提供商配置，让用户主动添加
    if (providers.value.length === 0) {
      providers.value = []
    }
  }

  // 获取预设的提供商模板
  const getProviderTemplate = (type: 'openai' | 'anthropic' | 'google' | 'custom') => {
    const templates = {
      openai: {
        name: 'OpenAI',
        type: 'openai' as const,
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        allowCustomUrl: true,
        models: [
          { id: 'gpt-5', name: 'GPT-5', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-5-mini', name: 'GPT-5 Mini', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-5-nano', name: 'GPT-5 Nano', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-5-pro', name: 'GPT-5 Pro', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-5-codex', name: 'GPT-5 Codex', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-4', name: 'GPT-4', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-4o', name: 'GPT-4o', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', enabled: true, apiType: 'openai' as const },
          { id: 'o1', name: 'O1', enabled: true, apiType: 'openai' as const },
          { id: 'o1-mini', name: 'O1 Mini', enabled: true, apiType: 'openai' as const }
        ]
      },
      anthropic: {
        name: 'Anthropic',
        type: 'anthropic' as const,
        baseUrl: 'https://api.anthropic.com/v1/messages',
        allowCustomUrl: true,
        models: [
          { id: 'claude-opus-4-1-20250805', name: 'Claude 4.1 Opus', enabled: true, apiType: 'anthropic' as const },
          { id: 'claude-opus-4-20250514', name: 'Claude 4 Opus', enabled: true, apiType: 'anthropic' as const },
          { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', enabled: true, apiType: 'anthropic' as const },
          { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', enabled: true, apiType: 'anthropic' as const },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', enabled: true, apiType: 'anthropic' as const },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', enabled: true, apiType: 'anthropic' as const },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', enabled: true, apiType: 'anthropic' as const }
        ]
      },
      google: {
        name: 'Gemini',
        type: 'google' as const,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        allowCustomUrl: true,
        models: [
          { id: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', enabled: true, apiType: 'google' as const },
          { id: 'gemini-2-5-flash', name: 'Gemini 2.5 Flash', enabled: true, apiType: 'google' as const },
          { id: 'gemini-2-5-flash-lite', name: 'Gemini 2.5 Flash-Lite', enabled: true, apiType: 'google' as const },
          { id: 'gemini-2-0-flash', name: 'Gemini 2.0 Flash', enabled: true, apiType: 'google' as const },
          { id: 'gemini-2-0-flash-lite', name: 'Gemini 2.0 Flash-Lite', enabled: true, apiType: 'google' as const },
          { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', enabled: true, apiType: 'google' as const },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', enabled: true, apiType: 'google' as const },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', enabled: true, apiType: 'google' as const }
        ]
      },
      custom: {
        name: '',
        type: 'custom' as const,
        baseUrl: 'https://api.example.com/v1/chat/completions',
        allowCustomUrl: true,
        models: []
      }
    }
    return templates[type]
  }

  // 获取可用的提供商
  const getAvailableProviders = () => {
    return providers.value.filter(p => p.enabled && p.apiKey.trim() !== '')
  }

  // 获取指定提供商的可用模型
  const getAvailableModels = (providerId: string) => {
    const provider = providers.value.find(p => p.id === providerId)
    return provider ? provider.models.filter(m => m.enabled) : []
  }

  // 获取当前选中的提供商配置
  const getCurrentProvider = () => {
    return providers.value.find(p => p.id === selectedProvider.value)
  }

  // 获取当前选中的模型配置
  const getCurrentModel = () => {
    const provider = getCurrentProvider()
    return provider ? provider.models.find(m => m.id === selectedModel.value) : null
  }

  // 添加新的提供商
  const addProvider = (type: 'openai' | 'anthropic' | 'google' | 'custom', customConfig?: Partial<ProviderConfig>) => {
    const template = getProviderTemplate(type)
    
    // 生成唯一ID
    const id = type === 'custom' 
      ? `custom_${Date.now()}` 
      : `${type}_${Date.now()}`
    
    const newProvider: ProviderConfig = {
      ...template,
      ...customConfig,
      id,
      apiKey: customConfig?.apiKey || '', // 确保apiKey不为undefined
      enabled: true, // 默认启用新添加的提供商
      models: template.models.map(model => ({
        ...model,
        provider: id
      }))
    }
    
    providers.value.push(newProvider)
    return newProvider
  }

  // 添加新模型到指定提供商
  const addModel = (providerId: string, model: Omit<ModelConfig, 'provider'>) => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      provider.models.push({
        ...model,
        provider: providerId
      })
    }
  }

  // 保存设置到本地存储
  const saveSettings = () => {
    localStorage.setItem('yprompt_providers', JSON.stringify(providers.value))
    localStorage.setItem('yprompt_selected_provider', selectedProvider.value)
    localStorage.setItem('yprompt_selected_model', selectedModel.value)
    localStorage.setItem('yprompt_stream_mode', JSON.stringify(streamMode.value))
  }

  // 从本地存储加载设置
  const loadSettings = () => {
    const savedProviders = localStorage.getItem('yprompt_providers')
    const savedProvider = localStorage.getItem('yprompt_selected_provider')
    const savedModel = localStorage.getItem('yprompt_selected_model')
    const savedStreamMode = localStorage.getItem('yprompt_stream_mode')

    if (savedProviders) {
      try {
        providers.value = JSON.parse(savedProviders)
      } catch (error) {
        initializeDefaults()
      }
    } else {
      initializeDefaults()
    }

    if (savedProvider) {
      selectedProvider.value = savedProvider
    }

    if (savedModel) {
      selectedModel.value = savedModel
    }

    if (savedStreamMode) {
      try {
        streamMode.value = JSON.parse(savedStreamMode)
      } catch (error) {
        streamMode.value = true // 默认开启流式模式
      }
    }

    // 如果没有选中的提供商，自动选择第一个可用的
    if (!selectedProvider.value) {
      const availableProviders = getAvailableProviders()
      if (availableProviders.length > 0) {
        selectedProvider.value = availableProviders[0].id
        const availableModels = getAvailableModels(selectedProvider.value)
        if (availableModels.length > 0) {
          selectedModel.value = availableModels[0].id
        }
      }
    }
  }

  // 删除提供商
  const deleteProvider = (providerId: string) => {
    const index = providers.value.findIndex(p => p.id === providerId)
    if (index > -1) {
      providers.value.splice(index, 1)
      // 如果删除的是当前选中的提供商，重置选择
      if (selectedProvider.value === providerId) {
        selectedProvider.value = ''
        selectedModel.value = ''
      }
    }
  }

  // 删除模型
  const deleteModel = (providerId: string, modelId: string) => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      const modelIndex = provider.models.findIndex(m => m.id === modelId)
      if (modelIndex > -1) {
        provider.models.splice(modelIndex, 1)
        // 如果删除的是当前选中的模型，重置选择
        if (selectedModel.value === modelId) {
          selectedModel.value = ''
        }
      }
    }
  }

  // 提示词编辑相关方法
  const openPromptEditor = (type: 'system' | 'user') => {
    editingPromptType.value = type
    // 加载当前的提示词内容到编辑器
    editingSystemRules.value = promptConfigManager.getSystemPromptRules()
    editingUserRules.value = promptConfigManager.getUserGuidedPromptRules()
    editingRequirementReportRules.value = promptConfigManager.getRequirementReportRules()
    showPromptEditor.value = true
  }

  const closePromptEditor = () => {
    showPromptEditor.value = false
    // 重置编辑内容
    editingSystemRules.value = ''
    editingUserRules.value = ''
    editingRequirementReportRules.value = ''
  }

  const savePromptRules = () => {
    // 保存编辑后的提示词规则
    promptConfigManager.updateSystemPromptRules(editingSystemRules.value)
    promptConfigManager.updateUserGuidedPromptRules(editingUserRules.value)
    promptConfigManager.updateRequirementReportRules(editingRequirementReportRules.value)
    closePromptEditor()
  }

  const resetSystemPromptRules = () => {
    // 重置系统提示词规则为默认值
    promptConfigManager.resetSystemPromptRules()
    editingSystemRules.value = promptConfigManager.getSystemPromptRules()
  }

  const resetUserPromptRules = () => {
    // 重置用户引导规则为默认值
    promptConfigManager.resetUserGuidedPromptRules()
    editingUserRules.value = promptConfigManager.getUserGuidedPromptRules()
  }

  const resetRequirementReportRules = () => {
    // 重置需求报告规则为默认值
    promptConfigManager.resetRequirementReportRules()
    editingRequirementReportRules.value = promptConfigManager.getRequirementReportRules()
  }

  // 获取当前的提示词规则
  const getCurrentSystemRules = () => {
    return promptConfigManager.getSystemPromptRules()
  }

  const getCurrentUserRules = () => {
    return promptConfigManager.getUserGuidedPromptRules()
  }

  // 更新模型测试状态
  const updateModelTestStatus = (providerId: string, modelId: string, status: 'untested' | 'testing' | 'success' | 'failed') => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      const model = provider.models.find(m => m.id === modelId)
      if (model) {
        model.testStatus = status
        if (status === 'testing') {
          model.lastTested = new Date()
        }
      }
    }
  }

  // 更新模型能力信息
  const updateModelCapabilities = (providerId: string, modelId: string, capabilities: ModelCapabilities) => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      const model = provider.models.find(m => m.id === modelId)
      if (model) {
        model.capabilities = capabilities
        model.lastTested = new Date()
        model.testStatus = capabilities.testResult?.connected ? 'success' : 'failed'
      }
    }
  }

  // 新增：快速更新连接状态（不等思考结果）
  const updateModelConnectionStatus = (providerId: string, modelId: string, connected: boolean, error?: string) => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      const model = provider.models.find(m => m.id === modelId)
      if (model) {
        // 如果还没有capabilities，创建一个临时的
        if (!model.capabilities) {
          model.capabilities = {
            reasoning: false,
            reasoningType: null,
            supportedParams: {
              temperature: true,
              maxTokens: 'max_tokens',
              streaming: true,
              systemMessage: true
            },
            testResult: {
              connected,
              reasoning: false,
              responseTime: 0,
              timestamp: new Date(),
              error
            }
          }
        } else {
          // 更新现有的连接状态
          if (model.capabilities.testResult) {
            model.capabilities.testResult.connected = connected
            model.capabilities.testResult.timestamp = new Date()
            if (error) {
              model.capabilities.testResult.error = error
            }
          }
        }
        
        model.lastTested = new Date()
        model.testStatus = connected ? 'success' : 'failed'
      }
    }
  }

  // 新增：清空模型测试状态
  const clearModelTestStatus = (providerId: string, modelId: string) => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      const model = provider.models.find(m => m.id === modelId)
      if (model) {
        model.testStatus = 'untested'
        model.capabilities = undefined
        model.lastTested = undefined
      }
    }
  }

  // 获取模型测试状态
  const getModelTestStatus = (providerId: string, modelId: string) => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      const model = provider.models.find(m => m.id === modelId)
      return model?.testStatus || 'untested'
    }
    return 'untested'
  }

  // 检查模型是否需要重新测试
  const shouldRetestModel = (providerId: string, modelId: string): boolean => {
    const provider = providers.value.find(p => p.id === providerId)
    if (provider) {
      const model = provider.models.find(m => m.id === modelId)
      if (!model?.lastTested || !model.capabilities) {
        return true
      }
      
      // 24小时后需要重新测试
      const age = Date.now() - model.lastTested.getTime()
      return age > 24 * 60 * 60 * 1000
    }
    return true
  }

  // 获取思考能力类型描述
  const getReasoningTypeDescription = (reasoningType: ReasoningType | null | undefined): string => {
    switch (reasoningType) {
      case 'openai-reasoning':
        return 'OpenAI o1系列推理能力'
      case 'gemini-thought':
        return 'Gemini内置思考功能'
      case 'claude-thinking':
        return 'Claude思考标签支持'
      case 'generic-cot':
        return '通用链式思考'
      default:
        return '无思考能力'
    }
  }


  const getCurrentRequirementReportRules = () => {
    return promptConfigManager.getRequirementReportRules()
  }

  return {
    showSettings,
    providers,
    selectedProvider,
    selectedModel,
    streamMode,
    // 提示词编辑状态
    showPromptEditor,
    editingPromptType,
    editingSystemRules,
    editingUserRules,
    editingRequirementReportRules,
    // 原有方法
    initializeDefaults,
    getProviderTemplate,
    getAvailableProviders,
    getAvailableModels,
    getCurrentProvider,
    getCurrentModel,
    addProvider,
    addModel,
    deleteProvider,
    deleteModel,
    saveSettings,
    loadSettings,
    // 提示词编辑方法
    openPromptEditor,
    closePromptEditor,
    savePromptRules,
    resetSystemPromptRules,
    resetUserPromptRules,
    resetRequirementReportRules,
    getCurrentSystemRules,
    getCurrentUserRules,
    getCurrentRequirementReportRules,
    // 新增：模型测试相关方法
    updateModelTestStatus,
    updateModelCapabilities,
    updateModelConnectionStatus,
    clearModelTestStatus,
    getModelTestStatus,
    shouldRetestModel,
    getReasoningTypeDescription,
  }
})