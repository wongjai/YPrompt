import { defineStore } from 'pinia'
import { ref } from 'vue'
import { promptConfigManager } from '@/config/prompts'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  enabled: boolean
  apiType?: 'openai' | 'anthropic' | 'google' // 模型使用的API类型
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
          { id: 'gpt-4o', name: 'GPT-4o', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', enabled: true, apiType: 'openai' as const },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', enabled: true, apiType: 'openai' as const }
        ]
      },
      anthropic: {
        name: 'Anthropic',
        type: 'anthropic' as const,
        baseUrl: 'https://api.anthropic.com/v1/messages',
        allowCustomUrl: true,
        models: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', enabled: true, apiType: 'anthropic' as const },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', enabled: true, apiType: 'anthropic' as const },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', enabled: true, apiType: 'anthropic' as const }
        ]
      },
      google: {
        name: 'Gemini',
        type: 'google' as const,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        allowCustomUrl: true,
        models: [
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
    getCurrentRequirementReportRules
  }
})