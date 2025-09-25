<template>
  <!-- 設置按鈕 -->
  <button
    @click="settingsStore.showSettings = true"
    class="fixed top-4 right-4 z-50 p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
    title="設置"
  >
    <Settings class="w-5 h-5 text-gray-600" />
  </button>

  <!-- 設置彈窗 -->
  <div
    v-if="settingsStore.showSettings"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click.self="settingsStore.showSettings = false"
  >
    <div class="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
      <!-- 頭部 -->
      <div class="flex items-center justify-between p-6 border-b flex-shrink-0">
        <div class="flex items-center space-x-4">
          <h2 class="text-xl font-semibold">設置</h2>
          <div class="flex space-x-1">
            <button
              @click="activeTab = 'providers'"
              :class="[
                'px-3 py-1 rounded text-sm font-medium transition-colors',
                activeTab === 'providers' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-800'
              ]"
            >
              AI模型
            </button>
            <button
              @click="activeTab = 'prompts'"
              :class="[
                'px-3 py-1 rounded text-sm font-medium transition-colors',
                activeTab === 'prompts' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-800'
              ]"
            >
              提示詞規則
            </button>
            <a
              href="https://github.com/fish2018"
              target="_blank"
              rel="noopener noreferrer"
              class="p-1 hover:bg-gray-100 rounded transition-colors"
              title="GitHub"
            >
              <svg class="w-5 h-5 text-gray-600 hover:text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>
        <button
          @click="settingsStore.showSettings = false"
          class="p-1 hover:bg-gray-100 rounded"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- 內容 -->
      <div class="p-6 overflow-y-auto flex-1">
        
        <!-- AI模型配置標籤頁 -->
        <div v-if="activeTab === 'providers'">
          <!-- 添加新提供商 -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium">AI服務提供商</h3>
              <button
                @click="showAddProviderTypeDialog = true"
                class="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                <Plus class="w-4 h-4" />
                <span>添加提供商</span>
              </button>
            </div>
          
            <!-- API配置說明 -->
            <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 class="text-sm font-medium text-blue-800 mb-2">API配置說明</h4>
              <div class="text-sm text-blue-700 space-y-2">
                <div><strong>OpenAI及兼容服務：</strong>API URL填寫完整路徑，如 <code class="bg-blue-100 px-1 rounded break-all text-xs">https://api.openai.com/v1/chat/completions</code></div>
                <div><strong>Anthropic Claude：</strong>API URL填寫 <code class="bg-blue-100 px-1 rounded break-all text-xs">https://api.anthropic.com/v1/messages</code></div>
                <div><strong>Google Gemini：</strong>API URL填寫 <code class="bg-blue-100 px-1 rounded break-all text-xs">https://generativelanguage.googleapis.com/v1beta</code>（系統會自動根據模型拼接路徑）</div>
                <div><strong>自定義提供商：</strong>大多數第三方服務使用OpenAI兼容格式，URL結構爲 <code class="bg-blue-100 px-1 rounded break-all text-xs">https://你的域名/v1/chat/completions</code></div>
                <div class="text-xs text-blue-600 mt-2">支持代理地址、中轉API等各種自定義URL</div>
              </div>
            </div>

            <!-- 空狀態 -->
            <div v-if="settingsStore.providers.length === 0" class="text-center py-8 text-gray-500">
              <Settings class="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>還沒有配置任何AI提供商</p>
              <p class="text-sm">點擊上方按鈕添加您的第一個AI服務</p>
            </div>

            <!-- 提供商列表 -->
            <div v-else class="space-y-4">
              <div
                v-for="provider in settingsStore.providers"
                :key="provider.id"
                class="border rounded-lg p-4"
              >
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center space-x-3">
                    <input
                      v-model="provider.enabled"
                      type="checkbox"
                      class="rounded"
                      @change="settingsStore.saveSettings"
                    />
                    <h4 class="font-medium">{{ provider.name }}</h4>
                    <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {{ provider.type }}
                    </span>
                    <CheckCircle v-if="provider.enabled && provider.apiKey" class="w-4 h-4 text-green-600" title="已配置" />
                  </div>
                  <div class="flex items-center space-x-2">
                    <button
                      @click="editProvider(provider)"
                      class="text-blue-500 hover:text-blue-700"
                      title="編輯提供商"
                    >
                      <Settings class="w-4 h-4" />
                    </button>
                    <button
                      @click="testConnection(provider)"
                      :disabled="testingProvider === provider.id || !provider.apiKey"
                      class="text-green-500 hover:text-green-700 disabled:opacity-50 transition-colors"
                      :title="testingProvider === provider.id ? '測試中...' : '測試連接'"
                    >
                      <Zap class="w-4 h-4" :class="{ 'animate-pulse': testingProvider === provider.id }" />
                    </button>
                    <button
                      @click="deleteProvider(provider.id)"
                      class="text-red-500 hover:text-red-700"
                      title="刪除提供商"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- API配置 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">API密鑰</label>
                    <input
                      v-model="provider.apiKey"
                      type="password"
                      placeholder="輸入API密鑰"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      @input="settingsStore.saveSettings"
                    />
                  </div>
                  <div v-if="provider.allowCustomUrl || provider.type === 'custom'">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      API URL
                      <span v-if="provider.type !== 'custom'" class="text-xs text-gray-500">(可選，留空使用官方完整地址)</span>
                    </label>
                    <input
                      v-model="provider.baseUrl"
                      type="url"
                      :placeholder="getDefaultBaseUrl(provider.type)"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      @input="settingsStore.saveSettings"
                    />
                  </div>
                </div>

                <!-- 模型列表 -->
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-sm font-medium text-gray-700">可用模型</label>
                    <button
                      @click="showAddModel(provider.id)"
                      class="text-sm text-blue-500 hover:text-blue-700"
                    >
                      添加模型
                    </button>
                  </div>
                  <div class="space-y-2 max-h-32 overflow-y-auto">
                    <div
                      v-for="model in provider.models"
                      :key="model.id"
                      class="relative flex items-center justify-between p-2 bg-gray-50 rounded min-w-0 overflow-x-auto"
                    >
                      <div class="flex items-center space-x-2 flex-shrink-0">
                        <input
                          v-model="model.enabled"
                          type="checkbox"
                          class="rounded flex-shrink-0"
                          @change="settingsStore.saveSettings"
                        />
                        <span class="text-sm font-medium whitespace-nowrap">{{ model.name }}</span>
                        
                        <!-- 能力指示器 - 緊湊排列 -->
                        <div class="flex items-center space-x-1 flex-shrink-0">
                          <span v-if="model.capabilities?.reasoning" 
                                class="inline-flex items-center text-xs bg-purple-100 text-purple-800 rounded-full w-4 h-4 justify-center"
                                :title="settingsStore.getReasoningTypeDescription(model.capabilities.reasoningType)">
                            🧠
                          </span>
                          <span v-if="model.capabilities?.testResult?.connected" 
                                class="inline-flex items-center text-xs bg-green-100 text-green-800 rounded-full w-4 h-4 justify-center">
                            ✅
                          </span>
                          <span v-if="model.testStatus === 'failed'" 
                                class="inline-flex items-center text-xs bg-red-100 text-red-800 rounded-full w-4 h-4 justify-center">
                            ❌
                          </span>
                        </div>
                        
                        <!-- API類型標籤 - 更小 -->
                        <span 
                          v-if="model.apiType"
                          class="text-xs px-1.5 py-0.5 rounded text-white flex-shrink-0"
                          :class="getApiTypeColor(model.apiType)"
                        >
                          {{ getApiTypeLabel(model.apiType) }}
                        </span>
                      </div>
                      
                      <!-- 操作按鈕 -->
                      <div class="flex items-center space-x-1 flex-shrink-0">
                        <!-- 模型級別測試按鈕 -->
                        <button
                          @click="testModel(provider.id, model.id)"
                          :disabled="model.testStatus === 'testing' || !provider.apiKey"
                          :class="[
                            'transition-colors text-sm',
                            model.testStatus === 'testing' ? 'text-blue-600' : 
                            model.testStatus === 'success' ? 'text-green-500 hover:text-green-700' :
                            model.testStatus === 'failed' ? 'text-red-500 hover:text-red-700' :
                            'text-gray-400 hover:text-blue-500'
                          ]"
                          :title="getTestButtonTitle(model)"
                        >
                          <Zap class="w-3 h-3" :class="{ 'animate-pulse': model.testStatus === 'testing' }" />
                        </button>
                        <button
                          @click="editModel(provider.id, model)"
                          class="text-blue-500 hover:text-blue-700"
                          title="編輯模型"
                        >
                          <Settings class="w-3 h-3" />
                        </button>
                        <button
                          @click="deleteModel(provider.id, model.id)"
                          class="text-red-500 hover:text-red-700"
                          title="刪除模型"
                        >
                          <X class="w-3 h-3" />
                        </button>
                      </div>
                      
                      <!-- 錯誤信息 - 只在有錯誤時顯示，佔滿寬度 -->
                      <div v-if="model.capabilities?.testResult?.error" class="absolute left-0 right-0 top-full mt-1 z-10">
                        <div class="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1 truncate" 
                             :title="model.capabilities.testResult.error">
                          {{ model.capabilities.testResult.error }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 提示詞規則標籤頁 -->
        <div v-if="activeTab === 'prompts'">
          <div class="space-y-6">
            <!-- 系統提示詞規則編輯器 -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-medium">系統提示詞規則</h3>
                <button
                  @click="resetSystemPromptRules"
                  class="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-300 rounded"
                >
                  重置爲默認
                </button>
              </div>
              <textarea
                v-model="settingsStore.editingSystemRules"
                placeholder="輸入系統提示詞規則..."
                class="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-xs"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">系統提示詞包含AI提示詞工程的完整指南，用於生成高質量的提示詞。</p>
            </div>

            <!-- 用戶引導規則編輯器 -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-medium">用戶引導規則</h3>
                <button
                  @click="resetUserPromptRules"
                  class="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-300 rounded"
                >
                  重置爲默認
                </button>
              </div>
              <textarea
                v-model="settingsStore.editingUserRules"
                placeholder="輸入用戶引導規則..."
                class="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-xs"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">用戶引導規則定義AI助手在對話中的行爲方式，包括智能判斷和對話終止機制。</p>
            </div>

            <!-- 需求報告規則編輯器 -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-medium">需求報告規則</h3>
                <button
                  @click="resetRequirementReportRules"
                  class="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-300 rounded"
                >
                  重置爲默認
                </button>
              </div>
              <textarea
                v-model="settingsStore.editingRequirementReportRules"
                placeholder="輸入需求報告生成規則..."
                class="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-xs"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">需求報告規則用於基於用戶對話歷史生成完整的需求總結報告。</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="flex justify-end space-x-3 p-6 border-t bg-gray-50 flex-shrink-0">
        <button
          @click="settingsStore.showSettings = false"
          class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          取消
        </button>
        <button
          @click="saveAndClose"
          class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          保存設置
        </button>
      </div>
    </div>
  </div>

  <!-- 選擇提供商類型彈窗 -->
  <div
    v-if="showAddProviderTypeDialog"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
  >
    <div class="bg-white rounded-lg max-w-md w-full p-6">
      <h3 class="text-lg font-semibold mb-4">選擇提供商類型</h3>
      
      <div class="space-y-3">
        <button
          v-for="providerType in availableProviderTypes"
          :key="providerType.type"
          @click="selectProviderType(providerType.type)"
          class="w-full p-4 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
        >
          <div class="flex items-center space-x-3">
            <div :class="providerType.color" class="w-3 h-3 rounded-full"></div>
            <div>
              <h4 class="font-medium">{{ providerType.name }}</h4>
              <p class="text-sm text-gray-500">{{ providerType.description }}</p>
            </div>
          </div>
        </button>
      </div>

      <div class="flex justify-end space-x-3 mt-6">
        <button
          @click="showAddProviderTypeDialog = false"
          class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          取消
        </button>
      </div>
    </div>
  </div>

  <!-- 添加提供商彈窗 -->
  <div
    v-if="showAddProvider"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
  >
    <div class="bg-white rounded-lg max-w-md w-full p-6">
      <h3 class="text-lg font-semibold mb-4">{{ editingProvider ? '編輯提供商' : `添加${selectedProviderType === 'custom' ? '自定義' : ''}提供商` }}</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">提供商名稱</label>
          <input
            v-model="newProvider.name"
            type="text"
            :placeholder="selectedProviderType === 'custom' ? '例如：DeepSeek' : '可自定義名稱'"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div v-if="selectedProviderType === 'custom' || (selectedProviderType && ['openai', 'anthropic', 'google'].includes(selectedProviderType) && getProviderTemplate(selectedProviderType).allowCustomUrl)">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            API URL
            <span v-if="selectedProviderType !== 'custom'" class="text-xs text-gray-500">(可選，留空使用官方完整地址)</span>
          </label>
          <input
            v-model="newProvider.baseUrl"
            type="url"
            :placeholder="getDefaultBaseUrl(selectedProviderType)"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">API密鑰</label>
          <input
            v-model="newProvider.apiKey"
            type="password"
            placeholder="輸入API密鑰"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div class="flex justify-end space-x-3 mt-6">
        <button
          @click="closeProviderDialog"
          class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          取消
        </button>
        <button
          @click="saveProvider"
          :disabled="!newProvider.name || (selectedProviderType === 'custom' && !newProvider.baseUrl)"
          class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {{ editingProvider ? '保存' : '添加' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 添加模型彈窗 -->
  <div
    v-if="showAddModelDialog"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
  >
    <div class="bg-white rounded-lg max-w-md w-full p-6">
      <h3 class="text-lg font-semibold mb-4">{{ editingModel ? '編輯模型' : '添加模型' }}</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">模型名稱</label>
          <input
            v-model="newModel.name"
            type="text"
            placeholder="例如：DeepSeek Chat"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-medium text-gray-700">模型ID</label>
            <!-- 只有OpenAI、Google和自定義提供商顯示獲取按鈕，Anthropic不支持 -->
            <button
              v-if="getProviderForModel(addingModelToProvider)?.type !== 'anthropic'"
              @click="fetchAvailableModels"
              :disabled="loadingModels"
              class="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50"
            >
              {{ loadingModels ? '獲取中...' : '🔄 獲取模型列表' }}
            </button>
          </div>
          <input
            v-model="newModel.id"
            type="text"
            placeholder="例如：deepseek-chat"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <!-- 可選擇的模型列表 -->
          <div v-if="getCurrentProviderModels.length > 0" class="mt-2">
            <p class="text-xs text-gray-600 mb-2">點擊選擇模型：</p>
            <div class="max-h-32 overflow-y-auto border border-gray-200 rounded">
              <div
                v-for="modelId in getCurrentProviderModels"
                :key="modelId"
                @click="selectModel(modelId)"
                class="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
              >
                {{ modelId }}
              </div>
            </div>
          </div>
          
          <!-- 獲取失敗提示 -->
          <div v-if="modelFetchError" class="mt-2">
            <p class="text-xs text-red-600">{{ modelFetchError }}</p>
          </div>
        </div>

        <div v-if="getProviderForModel(addingModelToProvider)?.type === 'custom'">
          <label class="block text-sm font-medium text-gray-700 mb-1">API類型</label>
          <select
            v-model="newModel.apiType"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">選擇API類型</option>
            <option value="openai">OpenAI 兼容</option>
            <option value="anthropic">Anthropic 兼容</option>
            <option value="google">Gemini 兼容</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">
            選擇此模型使用的API協議類型。大多數第三方代理服務使用OpenAI兼容格式。
          </p>
        </div>
      </div>

      <div class="flex justify-end space-x-3 mt-6">
        <button
          @click="showAddModelDialog = false"
          class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          取消
        </button>
        <button
          @click="addCustomModel"
          :disabled="!newModel.name || !newModel.id || (getProviderForModel(addingModelToProvider)?.type === 'custom' && !newModel.apiType)"
          class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {{ editingModel ? '保存' : '添加' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { AIService } from '@/services/aiService'
import { Settings, X, Plus, Trash2, CheckCircle, Zap } from 'lucide-vue-next'

const settingsStore = useSettingsStore()
const notificationStore = useNotificationStore()
const aiService = AIService.getInstance()

// 標籤頁狀態
const activeTab = ref('providers')

// 監聽標籤頁切換，自動加載提示詞內容
watch(activeTab, (newTab) => {
  if (newTab === 'prompts') {
    // 打開提示詞編輯器並加載內容
    settingsStore.openPromptEditor('system')
  }
})

const showAddProviderTypeDialog = ref(false)
const showAddProvider = ref(false)
const showAddModelDialog = ref(false)
const testingProvider = ref<string | null>(null)
const addingModelToProvider = ref<string>('')
const editingModel = ref<any>(null)
const editingProvider = ref<any>(null) // 正在編輯的提供商
const selectedProviderType = ref<'openai' | 'anthropic' | 'google' | 'custom'>('custom')

const newProvider = ref({
  name: '',
  baseUrl: '',
  apiKey: ''
})

const newModel = ref({
  name: '',
  id: '',
  apiType: '' as 'openai' | 'anthropic' | 'google' | ''
})

// 模型列表獲取相關狀態
const loadingModels = ref(false)
const providerModelsCache = ref<Record<string, string[]>>({}) // 按提供商ID緩存模型列表
const modelFetchError = ref('')

// 獲取當前提供商的模型列表
const getCurrentProviderModels = computed(() => {
  return providerModelsCache.value[addingModelToProvider.value] || []
})

// 可用的提供商類型
const availableProviderTypes = computed(() => {
  return [
    {
      type: 'openai' as const,
      name: 'OpenAI',
      description: '官方OpenAI API或兼容服務',
      color: 'bg-green-500'
    },
    {
      type: 'anthropic' as const,
      name: 'Anthropic',
      description: '官方Claude API或兼容服務',
      color: 'bg-purple-500'
    },
    {
      type: 'google' as const,
      name: 'Gemini',
      description: '官方Gemini API或兼容服務',
      color: 'bg-blue-500'
    },
    {
      type: 'custom' as const,
      name: '自定義服務',
      description: '第三方API服務或中轉代理',
      color: 'bg-gray-500'
    }
  ]
})

onMounted(() => {
  settingsStore.loadSettings()
})

// 獲取模型所屬的提供商
const getProviderForModel = (providerId: string) => {
  return settingsStore.providers.find(p => p.id === providerId)
}

// 獲取提供商模板
const getProviderTemplate = (type: 'openai' | 'anthropic' | 'google' | 'custom') => {
  return settingsStore.getProviderTemplate(type)
}

// 獲取默認完整API URL
const getDefaultBaseUrl = (type: string) => {
  switch (type) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions'
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages'
    case 'google':
      return 'https://generativelanguage.googleapis.com/v1beta'
    case 'custom':
      return 'https://api.example.com/v1'
    default:
      return ''
  }
}

// 獲取API類型顏色
const getApiTypeColor = (apiType: string) => {
  switch (apiType) {
    case 'openai':
      return 'bg-green-500'
    case 'anthropic':
      return 'bg-purple-500'
    case 'google':
      return 'bg-blue-500'
    default:
      return 'bg-gray-500'
  }
}

// 獲取API類型標籤
const getApiTypeLabel = (apiType: string) => {
  switch (apiType) {
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Claude'
    case 'google':
      return 'Gemini'
    default:
      return apiType
  }
}

// 選擇提供商類型
const selectProviderType = (type: 'openai' | 'anthropic' | 'google' | 'custom') => {
  showAddProviderTypeDialog.value = false
  selectedProviderType.value = type
  
  // 只在添加模式下重置表單
  if (!editingProvider.value) {
    if (type === 'custom') {
      // 自定義提供商需要填寫所有信息
      newProvider.value = { name: '', baseUrl: '', apiKey: '' }
    } else {
      // 官方提供商可以自定義名稱
      const template = settingsStore.getProviderTemplate(type)
      newProvider.value = { 
        name: template.name, 
        baseUrl: template.baseUrl || '', 
        apiKey: '' 
      }
    }
  }
  
  showAddProvider.value = true
}

// 編輯模型
const editModel = (providerId: string, model: any) => {
  editingModel.value = model
  addingModelToProvider.value = providerId
  newModel.value = {
    name: model.name,
    id: model.id,
    apiType: model.apiType || ''
  }
  showAddModelDialog.value = true
}

// 關閉提供商彈窗
const closeProviderDialog = () => {
  showAddProvider.value = false
  editingProvider.value = null
  newProvider.value = { name: '', baseUrl: '', apiKey: '' }
}

// 編輯提供商
const editProvider = (provider: any) => {
  editingProvider.value = provider
  selectedProviderType.value = provider.type
  newProvider.value = {
    name: provider.name,
    baseUrl: provider.baseUrl || '',
    apiKey: provider.apiKey || ''
  }
  showAddProvider.value = true
}

// 刪除提供商
const deleteProvider = (providerId: string) => {
  if (confirm('確定要刪除這個提供商嗎？這將同時刪除其所有模型配置。')) {
    settingsStore.deleteProvider(providerId)
    settingsStore.saveSettings()
    notificationStore.success('提供商已刪除')
  }
}

// 刪除模型
const deleteModel = (providerId: string, modelId: string) => {
  if (confirm('確定要刪除這個模型嗎？')) {
    settingsStore.deleteModel(providerId, modelId)
    settingsStore.saveSettings()
    notificationStore.success('模型已刪除')
  }
}

// 測試連接
const testConnection = async (provider: any) => {
  if (!provider.apiKey) {
    notificationStore.warning('請先配置API密鑰')
    return
  }

  const firstModel = provider.models.find((m: any) => m.enabled)
  if (!firstModel) {
    notificationStore.warning('請先啓用至少一個模型')
    return
  }

  testingProvider.value = provider.id
  try {
    const success = await aiService.testConnection(provider, firstModel.id)
    if (success) {
      notificationStore.success('連接測試成功！')
    } else {
      notificationStore.error('連接測試失敗，請檢查配置')
    }
  } catch (error) {
    notificationStore.error(`連接測試失敗: ${error}`)
  } finally {
    testingProvider.value = null
  }
}

// 新增：模型級別測試（優化版）
const testModel = async (providerId: string, modelId: string) => {
  const provider = settingsStore.providers.find(p => p.id === providerId)
  if (!provider) {
    notificationStore.error('未找到提供商配置')
    return
  }
  
  if (!provider.apiKey) {
    notificationStore.warning('請先配置API密鑰')
    return
  }

  // 1. 手動清空之前的狀態
  const model = provider.models.find(m => m.id === modelId)
  if (model) {
    model.testStatus = 'untested'
    model.capabilities = undefined
    model.lastTested = undefined
  }
  
  // 2. 設置測試中狀態
  settingsStore.updateModelTestStatus(providerId, modelId, 'testing')
  
  try {
    const { CapabilityDetector } = await import('@/services/capabilityDetector')
    const detector = CapabilityDetector.getInstance()
    
    // 使用優化的檢測方法：快速連接 + 異步思考
    await detector.detectCapabilitiesWithCallback(
      provider, 
      modelId,
      // 連接結果回調（快速響應，立即顯示✅）
      (connected: boolean, responseTime: number, error?: string) => {
        if (connected) {
          // 立即更新連接狀態，顯示✅指示器
          settingsStore.updateModelConnectionStatus(providerId, modelId, true)
          notificationStore.success(`模型 ${modelId} 連接成功！(${responseTime}ms) 正在後臺檢測思考能力...`)
        } else {
          settingsStore.updateModelConnectionStatus(providerId, modelId, false, error)
          notificationStore.error(`模型 ${modelId} 連接失敗：${error || '未知錯誤'}`)
        }
        // 保存設置（連接狀態）
        settingsStore.saveSettings()
      },
      // 思考能力結果回調（異步更新，可能會額外顯示🧠）
      (capabilities) => {
        settingsStore.updateModelCapabilities(providerId, modelId, capabilities)
        
        if (capabilities.reasoning) {
          const thinkingType = settingsStore.getReasoningTypeDescription(capabilities.reasoningType)
          notificationStore.success(`🧠 模型 ${modelId} 思考能力檢測完成：支持${thinkingType}`)
        }
        
        // 保存設置（最終結果）
        settingsStore.saveSettings()
      },
      true // 強制刷新緩存，因爲用戶主動點擊測試
    )
    
  } catch (error) {
    settingsStore.updateModelTestStatus(providerId, modelId, 'failed')
    notificationStore.error(`模型 ${modelId} 測試出錯：${(error as Error).message}`)
    settingsStore.saveSettings()
  }
}

// 獲取測試按鈕提示文本
const getTestButtonTitle = (model: any) => {
  switch (model.testStatus) {
    case 'testing':
      return '測試中...'
    case 'success':
      return '重新測試'
    case 'failed':
      return '重新測試'
    default:
      return '測試模型連接和能力'
  }
}


// 保存提供商（添加或編輯）
const saveProvider = () => {
  try {
    if (editingProvider.value) {
      // 編輯模式
      const provider = settingsStore.providers.find(p => p.id === editingProvider.value.id)
      if (provider) {
        provider.name = newProvider.value.name
        provider.apiKey = newProvider.value.apiKey
        if (provider.allowCustomUrl || provider.type === 'custom') {
          provider.baseUrl = newProvider.value.baseUrl
        }
      }
      editingProvider.value = null
    } else {
      // 添加模式
      settingsStore.addProvider(selectedProviderType.value, {
        name: newProvider.value.name,
        baseUrl: newProvider.value.baseUrl,
        apiKey: newProvider.value.apiKey
      })
    }
    
    newProvider.value = { name: '', baseUrl: '', apiKey: '' }
    showAddProvider.value = false
    settingsStore.saveSettings()
    notificationStore.success(editingProvider.value ? '提供商已更新' : '提供商已添加')
  } catch (error) {
    notificationStore.error(`保存失敗: ${error}`)
  }
}

// 添加/編輯模型
const addCustomModel = () => {
  const provider = settingsStore.providers.find(p => p.id === addingModelToProvider.value)
  if (!provider) return
  
  // 對於官方提供商，使用固定的API類型，對於自定義提供商，使用選擇的類型
  let apiType = newModel.value.apiType
  if (provider.type !== 'custom') {
    apiType = provider.type
  }
  
  if (editingModel.value) {
    // 編輯模式
    if (provider) {
      const modelIndex = provider.models.findIndex(m => m.id === editingModel.value.id)
      if (modelIndex > -1) {
        provider.models[modelIndex] = {
          ...provider.models[modelIndex],
          name: newModel.value.name,
          id: newModel.value.id,
          apiType: apiType as 'openai' | 'anthropic' | 'google'
        }
      }
    }
    editingModel.value = null
  } else {
    // 添加模式
    settingsStore.addModel(addingModelToProvider.value, {
      id: newModel.value.id,
      name: newModel.value.name,
      enabled: true,
      apiType: apiType as 'openai' | 'anthropic' | 'google'
    })
  }
  
  newModel.value = { name: '', id: '', apiType: '' }
  showAddModelDialog.value = false
  addingModelToProvider.value = ''
  settingsStore.saveSettings()
}

// 顯示添加模型彈窗
const showAddModel = (providerId: string) => {
  editingModel.value = null
  addingModelToProvider.value = providerId
  
  // 重置狀態（但保留緩存的模型列表）
  loadingModels.value = false
  modelFetchError.value = ''
  
  // 爲提供商預設API類型
  const provider = getProviderForModel(providerId)
  let defaultApiType = ''
  
  if (provider?.type === 'custom') {
    // 自定義提供商默認使用OpenAI兼容
    defaultApiType = 'openai'
  } else if (provider?.type && provider.type in ['openai', 'anthropic', 'google']) {
    // 官方提供商使用對應的類型
    defaultApiType = provider.type
  }
  
  newModel.value = { name: '', id: '', apiType: defaultApiType as 'openai' | 'anthropic' | 'google' | '' }
  showAddModelDialog.value = true
}

// 獲取可用模型列表
const fetchAvailableModels = async () => {
  try {
    loadingModels.value = true
    modelFetchError.value = ''
    
    const providerId = addingModelToProvider.value
    
    // 獲取當前提供商信息
    const provider = getProviderForModel(providerId)
    if (!provider) {
      throw new Error('未找到提供商信息')
    }
    
    // 檢查是否有必要的信息
    if (!provider.apiKey || !provider.baseUrl) {
      throw new Error('請先配置提供商的API密鑰和基礎URL')
    }
    
    // 獲取模型列表，優先使用用戶選擇的API類型
    const preferredApiType = newModel.value.apiType as 'openai' | 'anthropic' | 'google' | undefined
    const models = await aiService.getAvailableModels(provider, preferredApiType)
    
    // 將模型列表緩存到對應的提供商
    providerModelsCache.value[providerId] = models
    
    if (models.length === 0) {
      modelFetchError.value = '未找到可用模型'
    }
  } catch (error: any) {
    modelFetchError.value = error.message || '獲取模型列表失敗，請手動輸入模型ID'
  } finally {
    loadingModels.value = false
  }
}

// 選擇模型
const selectModel = (modelId: string) => {
  newModel.value.id = modelId
  // 如果模型名稱爲空，使用模型ID作爲默認名稱
  if (!newModel.value.name) {
    newModel.value.name = modelId
  }
}

// 重置系統提示詞規則
const resetSystemPromptRules = () => {
  if (confirm('確定要重置系統提示詞規則爲默認值嗎？')) {
    settingsStore.resetSystemPromptRules()
  }
}

// 重置用戶引導規則
const resetUserPromptRules = () => {
  if (confirm('確定要重置用戶引導規則爲默認值嗎？')) {
    settingsStore.resetUserPromptRules()
  }
}

// 重置需求報告規則
const resetRequirementReportRules = () => {
  if (confirm('確定要重置需求報告規則爲默認值嗎？')) {
    settingsStore.resetRequirementReportRules()
  }
}

const saveAndClose = () => {
  // 保存提示詞規則（如果有修改的話）
  if (settingsStore.editingSystemRules || settingsStore.editingUserRules || settingsStore.editingRequirementReportRules) {
    settingsStore.savePromptRules()
  }
  // 保存其他設置
  settingsStore.saveSettings()
  settingsStore.showSettings = false
}
</script>