<template>
  <div 
    class="bg-white rounded-lg shadow-sm flex flex-col h-full max-h-full overflow-hidden relative"
    @dragover.prevent="handleGlobalDragOver"
    @dragenter.prevent="handleGlobalDragEnter"
    @dragleave.prevent="handleGlobalDragLeave"
    @drop.prevent="handleGlobalDrop"
  >
    <div class="p-4 border-b border-gray-200 flex-shrink-0">
      <div class="flex justify-between items-center">
        <div class="flex items-center space-x-2">
          <h2 class="font-semibold text-gray-800">AI助手對話</h2>
          <button
            @click="showModelSelector = !showModelSelector"
            class="p-1 hover:bg-gray-100 rounded transition-colors"
            :title="chatModel ? `當前模型: ${getChatModelDisplay()}` : '選擇AI助手專用模型'"
          >
            <svg class="w-4 h-4 text-gray-600 hover:text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4 4m4-4l-4-4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
          </button>
        </div>
        <div class="flex items-center space-x-3">
          <!-- 移動端摺疊按鈕 -->
          <button
            v-if="isMobile && isExpanded"
            @click="$emit('toggle')"
            class="p-1 hover:bg-gray-100 rounded transition-colors"
            title="摺疊"
          >
            <ChevronUp class="w-5 h-5 text-gray-500" />
          </button>
          
          <!-- 流式開關 -->
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-600">流式:</span>
            <button
              @click="toggleStreamMode"
              :class="[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                isStreamMode 
                  ? 'bg-blue-500' 
                  : 'bg-gray-300'
              ]"
              :title="isStreamMode ? '關閉流式模式' : '開啓流式模式'"
            >
              <span
                :class="[
                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                  isStreamMode ? 'translate-x-5' : 'translate-x-1'
                ]"
              />
            </button>
          </div>
          
          <button
            @click="clearChat"
            class="text-gray-500 hover:text-gray-700 text-sm"
          >
            重新開始
          </button>
        </div>
      </div>
      
      <!-- AI助手模型選擇器 -->
      <div v-if="showModelSelector" class="px-4 pb-2 border-b border-gray-200 bg-gray-50">
        <div class="py-2 space-y-2">
          <!-- 標題行 -->
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-gray-700">AI助手專用模型</label>
            <button
              v-if="chatProvider"
              @click="resetChatModel"
              class="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              title="重置爲全局模型"
            >
              重置
            </button>
          </div>
          
          <!-- 選擇器行 - 桌面端橫向，移動端豎向 -->
          <div class="flex flex-col sm:flex-row gap-2">
            <div class="flex-1">
              <select
                v-model="chatProvider"
                @change="onChatProviderChange"
                class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">使用全局模型</option>
                <option
                  v-for="provider in availableChatProviders"
                  :key="provider.id"
                  :value="provider.id"
                >
                  {{ provider.name }}
                </option>
              </select>
            </div>
            
            <div class="flex-1">
              <select
                v-model="chatModel"
                @change="saveChatModelSettings"
                :disabled="!chatProvider"
                class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
              >
                <option value="">選擇模型</option>
                <option
                  v-for="model in availableChatModels"
                  :key="model.id"
                  :value="model.id"
                >
                  {{ model.name }}
                </option>
              </select>
            </div>
          </div>
          
          <!-- 當前狀態提示 -->
          <div class="text-xs text-gray-500">
            <span v-if="!chatProvider">當前: 跟隨全局模型設置</span>
            <span v-else-if="!chatModel">請選擇模型</span>
            <span v-else>當前: {{ getChatModelDisplay() }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Messages - 可滾動區域 -->
    <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" :style="{ maxHeight: chatContainerMaxHeight }">
      <div
        v-for="(message, index) in promptStore.chatMessages.filter(msg => !msg.isDeleted)"
        :key="message.id || index"
        :class="message.type === 'user' ? 'justify-end' : 'justify-start'"
        class="flex group"
      >
        <div class="flex flex-col w-full" :class="message.isEditing ? 'max-w-2xl' : 'max-w-xs lg:max-w-md'">
          <!-- 消息內容 -->
          <div
            :class="[
              message.isEditing 
                ? 'bg-white border-2 border-blue-300 shadow-lg' 
                : message.type === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : message.isProgress 
                    ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                    : 'bg-gray-100 text-gray-800',
              message.isProgress && 'animate-pulse',
              !message.isEditing && (message.type === 'user' ? 'ml-auto' : 'mr-auto')
            ]"
            class="px-4 py-3 rounded-lg transition-all duration-300 relative"
          >
            <!-- 編輯模式 -->
            <div v-if="message.isEditing" class="space-y-3">
              <div class="text-sm text-gray-600 font-medium mb-2">
                編輯{{ message.type === 'user' ? '用戶' : 'AI' }}消息
              </div>
              <textarea
                :ref="(el: any) => setEditTextareaRef(message.id!, el as HTMLTextAreaElement)"
                v-model="editingContent[message.id!]"
                class="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 bg-white min-h-[120px] max-h-[300px] overflow-y-auto"
                @keydown="handleEditKeydown($event, message.id!)"
                placeholder="編輯消息內容..."
              ></textarea>
              <div class="text-xs text-gray-500 mt-1">
                快捷鍵：Ctrl+Enter 保存，Escape 取消
              </div>
            </div>
            
            <!-- 正常顯示模式 -->
            <div v-else>
              <div
                v-if="message.type === 'ai'"
                v-html="renderMarkdown(message.content)"
                class="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-800"
              ></div>
              <div 
                v-else 
                v-html="renderUserMessage(message.content)"
                class="text-white [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-white [&_h5]:text-sm [&_h5]:font-bold [&_h5]:text-white [&_h6]:text-sm [&_h6]:font-bold [&_h6]:text-white [&_p]:text-white [&_p]:mb-2 [&_strong]:font-bold [&_strong]:text-white [&_b]:font-bold [&_b]:text-white [&_em]:italic [&_em]:text-white [&_i]:italic [&_i]:text-white [&_ul]:list-disc [&_ul]:list-inside [&_ul]:text-white [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:text-white [&_ol]:mb-2 [&_li]:text-white [&_li]:mb-1 [&_code]:bg-blue-600 [&_code]:text-blue-100 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_pre]:bg-blue-600 [&_pre]:text-blue-100 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_a]:text-blue-200 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-blue-300 [&_blockquote]:pl-2 [&_blockquote]:text-blue-100"
              ></div>
            </div>
          </div>
          
          <!-- 附件列表顯示 -->
          <div 
            v-if="message.attachments && message.attachments.length > 0 && !message.isEditing"
            class="mt-2"
            :class="message.type === 'user' ? 'ml-auto max-w-xs lg:max-w-md' : 'mr-auto max-w-xs lg:max-w-md'"
          >
            <div class="text-xs text-gray-500 mb-1">附件 ({{ message.attachments.length }})</div>
            <!-- 橫向滑動容器 -->
            <div class="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-1">
              <div
                v-for="attachment in message.attachments"
                :key="attachment.id"
                class="flex-shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border min-w-0"
                :class="message.type === 'user' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-100'"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <!-- 文件圖標 -->
                  <div class="flex-shrink-0">
                    <div v-if="attachment.type === 'image'" class="w-3 h-3 text-green-500">🖼️</div>
                    <div v-else-if="attachment.type === 'document'" class="w-3 h-3 text-blue-500">📄</div>
                    <div v-else-if="attachment.type === 'audio'" class="w-3 h-3 text-purple-500">🎵</div>
                    <div v-else-if="attachment.type === 'video'" class="w-3 h-3 text-red-500">🎬</div>
                    <div v-else class="w-3 h-3 text-gray-500">📎</div>
                  </div>
                  <!-- 文件名和大小 -->
                  <div class="min-w-0 flex-1">
                    <div 
                      class="truncate max-w-20 font-medium text-xs"
                      :class="message.type === 'user' ? 'text-blue-700' : 'text-gray-700'"
                      :title="attachment.name"
                    >
                      {{ attachment.name }}
                    </div>
                    <div 
                      class="text-xs"
                      :class="message.type === 'user' ? 'text-blue-500' : 'text-gray-500'"
                    >
                      {{ (attachment.size / 1024).toFixed(1) }}KB
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 消息操作按鈕 -->
          <div 
            v-if="!message.isProgress"
            class="flex space-x-1 mt-2 transition-opacity duration-200"
            :class="[
              message.isEditing 
                ? 'opacity-100 justify-center' 
                : 'opacity-0 group-hover:opacity-100 ' + (message.type === 'user' ? 'justify-end' : 'justify-start')
            ]"
          >
            <!-- 編輯狀態下的按鈕 -->
            <template v-if="message.isEditing">
              <button
                @click="saveEdit(message.id!)"
                class="flex items-center space-x-1 px-3 py-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors rounded-lg border border-green-200"
                title="保存編輯 (Ctrl+Enter)"
              >
                <Check class="w-4 h-4" />
                <span class="text-sm font-medium">保存</span>
              </button>
              
              <button
                v-if="message.type === 'user'"
                @click="resendMessage(message.id!)"
                class="flex items-center space-x-1 px-3 py-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors rounded-lg border border-blue-200"
                title="保存並重新發送"
                :disabled="promptStore.isTyping || promptStore.isGenerating"
              >
                <Send class="w-4 h-4" />
                <span class="text-sm font-medium">重新發送</span>
              </button>
              
              <button
                @click="cancelEdit(message.id!)"
                class="flex items-center space-x-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-colors rounded-lg border border-gray-200"
                title="取消編輯 (Escape)"
              >
                <X class="w-4 h-4" />
                <span class="text-sm font-medium">取消</span>
              </button>
            </template>
            
            <!-- 正常狀態下的按鈕 -->
            <template v-else>
              <!-- 重新生成按鈕（僅AI消息） -->
              <button
                v-if="message.type === 'ai'"
                @click="regenerateMessage(message.id!, index)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="重新生成回覆"
                :disabled="promptStore.isTyping || promptStore.isGenerating"
              >
                <RefreshCw class="w-3.5 h-3.5" />
              </button>
              
              <!-- 重新發送按鈕（僅用戶消息） -->
              <button
                v-if="message.type === 'user'"
                @click="resendUserMessage(message.id!, index)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="重新發送消息"
                :disabled="promptStore.isTyping || promptStore.isGenerating"
              >
                <Send class="w-3.5 h-3.5" />
              </button>
              
              <!-- 編輯按鈕 -->
              <button
                @click="startEdit(message.id!)"
                class="p-1.5 text-gray-500 hover:text-green-600 transition-colors rounded-lg hover:bg-gray-100"
                title="編輯消息"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </button>
              
              <!-- 刪除按鈕 -->
              <button
                @click="deleteMessage(message.id!)"
                class="p-1.5 text-gray-500 hover:text-red-600 transition-colors rounded-lg hover:bg-gray-100"
                title="刪除消息"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
              
              <!-- 複製按鈕 -->
              <button
                @click="copyMessage(message.content)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="複製消息內容"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </template>
          </div>
        </div>
      </div>
      
      <!-- Typing indicator -->
      <div v-if="promptStore.isTyping" class="flex justify-start">
        <div class="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
          <div class="flex space-x-1">
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 快速回複選項 - 在輸入區域內部 -->
    <div v-if="shouldShowQuickReplies" class="px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
      <div class="text-xs text-gray-500 mb-2">快速回復：</div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="reply in quickReplies"
          :key="reply"
          @click="selectQuickReply(reply)"
          class="px-3 py-1 text-sm bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
        >
          {{ reply }}
        </button>
      </div>
    </div>

    <!-- Input Area - 固定在底部 -->
    <div ref="inputContainer" class="p-3 border-t border-gray-200 bg-white flex-shrink-0 relative">
      <!-- 隱藏的文件輸入控件 -->
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,.java,.c,.cpp,.yaml,.yml"
        @change="handleFileSelect"
        class="hidden"
      />
      
      <!-- 附件預覽區域（緊湊橫向滑動） -->
      <div v-if="currentAttachments.length > 0" class="mb-3 p-3 bg-gray-50 rounded-lg">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-gray-600">已選擇 {{ currentAttachments.length }} 個附件</span>
          <button
            @click="currentAttachments = []"
            class="text-xs text-red-500 hover:text-red-700"
          >
            清空全部
          </button>
        </div>
        <div class="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div
            v-for="attachment in currentAttachments"
            :key="attachment.id"
            class="flex-shrink-0 flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-gray-200 min-w-0"
          >
            <div class="flex items-center gap-2 min-w-0">
              <!-- 文件圖標 -->
              <div class="flex-shrink-0">
                <div v-if="attachment.type === 'image'" class="w-4 h-4 text-green-500">🖼️</div>
                <div v-else-if="attachment.type === 'document'" class="w-4 h-4 text-blue-500">📄</div>
                <div v-else-if="attachment.type === 'audio'" class="w-4 h-4 text-purple-500">🎵</div>
                <div v-else-if="attachment.type === 'video'" class="w-4 h-4 text-red-500">🎬</div>
                <div v-else class="w-4 h-4 text-gray-500">📎</div>
              </div>
              <!-- 文件名和大小 -->
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium text-gray-700 truncate max-w-24" :title="attachment.name">
                  {{ attachment.name }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ (attachment.size / 1024).toFixed(1) }}KB
                </div>
              </div>
            </div>
            <!-- 移除按鈕 -->
            <button
              @click="removeAttachment(attachment.id)"
              class="flex-shrink-0 w-4 h-4 text-gray-400 hover:text-red-500 transition-colors"
              title="移除附件"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      
      <!-- 輸入框容器 - 真正的分區設計 -->
      <div class="relative border border-gray-300 rounded-2xl focus-within:outline-none focus-within:border-gray-300 overflow-hidden" style="height: 120px;">
        <!-- 文字輸入區域容器 - 固定高度，爲按鈕預留空間 -->
        <div class="absolute top-0 left-0 right-0" style="bottom: 48px;">
          <textarea
            ref="textareaRef"
            v-model="userInput"
            @keydown="handleKeydown"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
            @input="adjustTextareaHeight"
            @focus="showQuickReplies = true"
            :placeholder="shouldShowQuickReplies ? '輸入或點擊上方快速回復...' : 'Shift+Enter換行'"
            :disabled="promptStore.isTyping || promptStore.isGenerating"
            class="w-full h-full px-2 pt-3 pb-1 border-0 outline-none resize-none disabled:opacity-50 text-base overflow-y-auto bg-transparent"
            rows="1"
          ></textarea>
        </div>
        
        <!-- 按鈕專用區域 - 固定在底部48px -->
        <div class="absolute bottom-0 left-0 right-0 h-12 flex justify-between items-center px-2 bg-transparent pointer-events-none">
          <!-- 附件按鈕 -->
          <button
            @click="triggerFileSelect"
            class="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center justify-center pointer-events-auto"
            title="支持拖拽上傳圖片、文檔、音頻等格式，單個文件最大25MB"
          >
            <div class="relative">
              <Paperclip class="w-4 h-4" />
              <span 
                v-if="currentAttachments.length > 0" 
                class="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-3 h-3 flex items-center justify-center"
                style="font-size: 9px;"
              >
                {{ currentAttachments.length }}
              </span>
            </div>
          </button>
          
          <!-- 發送按鈕 -->
          <button
            @click="sendMessage"
            :disabled="!userInput.trim() || promptStore.isTyping || promptStore.isGenerating"
            class="w-8 h-8 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center pointer-events-auto"
          >
            <ArrowUp class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    
    <!-- 全局拖拽覆蓋層 -->
    <div
      v-if="isGlobalDragging"
      class="absolute inset-0 bg-blue-50 bg-opacity-90 flex items-center justify-center z-50 border-2 border-dashed border-blue-400 rounded-lg"
    >
      <div class="text-center">
        <Upload class="w-12 h-12 mx-auto mb-4 text-blue-500" />
        <div class="text-lg font-medium text-blue-700 mb-2">
          釋放文件以上傳
        </div>
        <div class="text-sm text-blue-600">
          支持圖片、文檔、音頻等格式
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue'
import { usePromptStore } from '@/stores/promptStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { AIGuideService } from '@/services/aiGuideService'
import { AIService } from '@/services/aiService'
import { PromptGeneratorService } from '@/services/promptGeneratorService'
import { getPromptGeneratorConfig } from '@/config/promptGenerator'
import { ArrowUp, ChevronUp, RefreshCw, Edit2, Trash2, Copy, Check, X, Send, Upload, Paperclip } from 'lucide-vue-next'
import { marked } from 'marked'
import { cleanAIResponse, checkAIDecision } from '@/utils/aiResponseUtils'
import type { MessageAttachment } from '@/stores/promptStore'

// Props
const props = defineProps<{
  isMobile?: boolean
  isExpanded?: boolean
}>()

// Emits
defineEmits<{
  toggle: []
}>()

// 解構props以避免未使用警告
const { isMobile, isExpanded } = props

// 模塊配置（便於將來封裝）
const config = getPromptGeneratorConfig()

const promptStore = usePromptStore()
const settingsStore = useSettingsStore()
const notificationStore = useNotificationStore()
const aiGuideService = AIGuideService.getInstance()
const userInput = ref('')
const chatContainer = ref<HTMLElement>()
const inputContainer = ref<HTMLElement>()
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()

// 文件上傳相關狀態
const currentAttachments = ref<MessageAttachment[]>([])
const isGlobalDragging = ref(false)

// 編輯相關狀態
const editingContent = ref<Record<string, string>>({})
const editTextareaRefs = ref<Record<string, HTMLTextAreaElement | null>>({})

// 流式模式狀態
const isStreamMode = ref(true) // 默認開啓流式模式

// AI助手專用模型狀態
const showModelSelector = ref(false)
const chatProvider = ref<string>('')
const chatModel = ref<string>('')

// 輸入法組合狀態
const isComposing = ref(false)

// 自動調整textarea高度 - 簡化版本，因爲高度現在由容器控制
const adjustTextareaHeight = () => {
  // 高度現在由容器的 CSS 控制，不需要動態調整
  // 保持這個函數是爲了兼容性
}

// 快速回復功能
const showQuickReplies = ref(false)

// 動態計算快捷回覆選項，強制觸發選項只在第6輪對話後顯示（3輪用戶輸入後）
const quickReplies = computed(() => {
  const messageCount = promptStore.chatMessages.length
  const baseReplies = ['請使用相關最佳實踐的推薦建議']
  
  // 如果對話輪數大於等於6（表示至少3輪用戶輸入），添加強制觸發選項
  if (messageCount >= 6) {
    return [...baseReplies, '強制生成需求報告']
  }
  
  return baseReplies
})

// 檢查是否爲強制觸發關鍵詞
const checkForceGenerate = (userInput: string): boolean => {
  const forceKeywords = ['強制生成需求報告']
  return forceKeywords.some(keyword => userInput.includes(keyword))
}

// 切換流式模式
const toggleStreamMode = () => {
  isStreamMode.value = !isStreamMode.value
  // 可以選擇將狀態保存到本地存儲
  localStorage.setItem('yprompt_stream_mode', JSON.stringify(isStreamMode.value))
}

// AI助手專用模型相關計算屬性和方法
const availableChatProviders = computed(() => {
  return settingsStore.getAvailableProviders()
})

const availableChatModels = computed(() => {
  if (!chatProvider.value) return []
  return settingsStore.getAvailableModels(chatProvider.value)
})

const onChatProviderChange = () => {
  chatModel.value = ''
  const models = availableChatModels.value
  if (models.length > 0) {
    chatModel.value = models[0].id
  }
  saveChatModelSettings()
}

const saveChatModelSettings = () => {
  localStorage.setItem('yprompt_chat_provider', chatProvider.value)
  localStorage.setItem('yprompt_chat_model', chatModel.value)
}

const resetChatModel = () => {
  chatProvider.value = ''
  chatModel.value = ''
  saveChatModelSettings()
  showModelSelector.value = false
}

const getChatModelDisplay = () => {
  if (!chatProvider.value || !chatModel.value) return '全局模型'
  const provider = availableChatProviders.value.find(p => p.id === chatProvider.value)
  const model = availableChatModels.value.find(m => m.id === chatModel.value)
  return `${provider?.name} - ${model?.name}`
}

// 獲取當前AI助手應該使用的模型
const getCurrentChatModel = () => {
  if (chatProvider.value && chatModel.value) {
    const provider = availableChatProviders.value.find(p => p.id === chatProvider.value)
    const model = availableChatModels.value.find(m => m.id === chatModel.value)
    return { provider, model }
  }
  // 回退到全局模型
  const globalProvider = settingsStore.getCurrentProvider()
  const globalModel = settingsStore.getCurrentModel()
  return { provider: globalProvider, model: globalModel }
}

// 計算是否應該顯示快捷回覆（從第二個問題開始）
const shouldShowQuickReplies = computed(() => {
  // 對話消息數大於2（AI初始問題 + 用戶第一次回答）時才顯示快捷回覆
  return promptStore.chatMessages.length >= 2 && showQuickReplies.value
})

// 動態計算聊天容器的最大高度
const chatContainerMaxHeight = computed(() => {
  // 基於原來的計算，只在模型選擇器顯示時額外減少高度
  const baseCalculation = shouldShowQuickReplies.value ? 420 : 340
  
  // 根據屏幕尺寸調整模型選擇器高度
  // 移動端垂直排列高度較大，PC端水平排列高度較小
  let modelSelectorExtraHeight = 0
  if (showModelSelector.value) {
    // 使用CSS媒體查詢邏輯：sm斷點是640px
    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      // PC端：水平排列，高度約114px
      modelSelectorExtraHeight = 114
    } else {
      // 移動端：垂直排列，高度約120px
      modelSelectorExtraHeight = 120
    }
  }
  
  const totalReduction = baseCalculation + modelSelectorExtraHeight
  return `calc(100vh - ${totalReduction}px)`
})

// 點擊外部區域隱藏快捷回覆
const handleClickOutside = (event: MouseEvent) => {
  if (inputContainer.value && !inputContainer.value.contains(event.target as Node)) {
    showQuickReplies.value = false
  }
}

// Markdown渲染函數
const renderMarkdown = (content: string): string => {
  try {
    const result = marked(content, {
      breaks: true,
      gfm: true
    })
    // 確保返回字符串類型
    return typeof result === 'string' ? result : String(result)
  } catch (error) {
    return content // 降級爲純文本
  }
}

// 用戶消息渲染函數 - 支持換行和基礎markdown
const renderUserMessage = (content: string): string => {
  try {
    // 檢查是否包含明顯的markdown語法
    const hasMarkdown = /^#|^\*\*|^##|^\*|^-|\*\*.*\*\*|^1\.|```/.test(content) || 
                       content.includes('**') || content.includes('##') || content.includes('# ')
    
    if (hasMarkdown || content.length > 50) { // 長文本默認用markdown渲染
      // 使用markdown渲染
      const result = marked(content, {
        breaks: true,
        gfm: true
      })
      return typeof result === 'string' ? result : String(result)
    } else {
      // 簡單文本只處理換行符
      return content.replace(/\n/g, '<br>')
    }
  } catch (error) {
    // 錯誤時使用markdown渲染作爲兜底
    try {
      const result = marked(content, { breaks: true, gfm: true })
      return typeof result === 'string' ? result : String(result)
    } catch {
      return content.replace(/\n/g, '<br>')
    }
  }
}

// 初始化對話（模塊化設計）
const initializeChat = async () => {
  // 加載流式模式設置
  const savedStreamMode = localStorage.getItem('yprompt_stream_mode')
  if (savedStreamMode) {
    try {
      isStreamMode.value = JSON.parse(savedStreamMode)
    } catch (error) {
      console.error('Failed to parse stream mode setting:', error)
    }
  }
  
  if (promptStore.chatMessages.length === 0 && !promptStore.isInitialized) {
    promptStore.isInitialized = true
    await simulateTyping(config.welcomeMessage, false)
  }
}

// 掛載和卸載事件監聽器
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  
  // 加載AI助手模型設置
  const savedProvider = localStorage.getItem('yprompt_chat_provider')
  const savedModel = localStorage.getItem('yprompt_chat_model')
  if (savedProvider) {
    chatProvider.value = savedProvider
  }
  if (savedModel) {
    chatModel.value = savedModel
  }
  
  // 加載流式模式設置
  const savedStreamMode = localStorage.getItem('yprompt_stream_mode')
  if (savedStreamMode !== null) {
    try {
      isStreamMode.value = JSON.parse(savedStreamMode)
    } catch (e) {
      isStreamMode.value = true // 默認開啓
    }
  }
  
  // 初始化對話
  initializeChat()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 選擇快速回復
const selectQuickReply = (reply: string) => {
  userInput.value = reply
  showQuickReplies.value = false
  sendMessage()
}

// 滾動到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// 監聽消息變化，自動滾動
watch(() => promptStore.chatMessages.length, scrollToBottom)
watch(() => promptStore.isTyping, scrollToBottom)

// 流式消息顯示
let currentStreamingMessageIndex = -1

// 開始流式消息顯示
const startStreamingMessage = () => {
  promptStore.isTyping = false // 停止thinking狀態
  promptStore.addMessage('ai', '', undefined)
  currentStreamingMessageIndex = promptStore.chatMessages.length - 1
  return currentStreamingMessageIndex
}

// 更新流式消息內容
const updateStreamingMessage = (content: string) => {
  if (currentStreamingMessageIndex >= 0 && currentStreamingMessageIndex < promptStore.chatMessages.length) {
    promptStore.chatMessages[currentStreamingMessageIndex].content = content
  }
}

// 模擬AI打字效果或流式顯示
const simulateTyping = async (message: string, isStreaming: boolean = false) => {
  
  if (isStreaming) {
    // 流式顯示：立即添加空消息，然後逐步更新
    const messageIndex = promptStore.chatMessages.length
    promptStore.addMessage('ai', '', undefined)
    
    // 逐字符顯示效果
    for (let i = 0; i <= message.length; i++) {
      promptStore.chatMessages[messageIndex].content = message.substring(0, i)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10))
    }
  } else {
    // 非流式：先顯示打字效果，然後顯示完整消息
    promptStore.isTyping = true
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100))
    promptStore.isTyping = false
    promptStore.addMessage('ai', message, undefined)
  }
}

// 發送消息
const sendMessage = async () => {
  // 限制：必須有文本內容才能發送，不允許只發送附件
  if (!userInput.value.trim()) {
    if (currentAttachments.value.length > 0) {
      notificationStore.warning('請輸入消息內容，不能只發送附件')
    }
    return
  }
  
  // 檢查是否配置了AI模型
  const { provider, model } = getCurrentChatModel()
  
  if (!provider || !model) {
    notificationStore.warning('請先在右上角設置中配置AI模型和API密鑰')
    return
  }

  const currentInput = userInput.value
  const attachments = [...currentAttachments.value]
  
  console.log('[ChatInterface] Sending message with attachments:', {
    hasInput: !!currentInput.trim(),
    attachmentCount: attachments.length,
    attachments: attachments.map(att => ({ name: att.name, type: att.type, size: att.size, hasData: !!att.data }))
  })
  
  // 檢查是否爲強制觸發關鍵詞
  const isForceGenerate = checkForceGenerate(currentInput)
  
  // 添加用戶消息（包含附件）
  promptStore.addMessage('user', currentInput, attachments)
  
  // 清空輸入和附件
  userInput.value = ''
  currentAttachments.value = []
  showQuickReplies.value = false // 發送後隱藏快速回復
  
  // 立即重置textarea高度到默認值
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = '80px'
  }
  
  // 如果是強制觸發，直接生成需求報告
  if (isForceGenerate) {
    console.log('[ChatInterface] Force generate triggered by user input')
    // 顯示確認消息
    await simulateTyping('好的，我將立即爲您生成需求報告。', false)
    
    setTimeout(async () => {
      // 使用全局模型生成提示詞，不使用AI助手專用模型
      const globalProvider = settingsStore.getCurrentProvider()
      const globalModel = settingsStore.getCurrentModel()
      if (globalProvider && globalModel) {
        await generatePrompt(globalProvider, globalModel.id)
      }
    }, 800)
    return
  }

  // 立即顯示AI正在思考的狀態
  promptStore.isTyping = true

  try {
    // 根據用戶設置使用流式或非流式模式
    const useStreamMode = isStreamMode.value
    
    if (useStreamMode) {
      // 流式模式
      const aiService = AIService.getInstance()
      
      // 準備流式顯示
      let streamingContent = ''
      let messageIndex = -1
      
      // 設置流式回調函數
      aiService.setStreamUpdateCallback((chunk: string) => {
        if (messageIndex === -1) {
          // 第一次收到數據，創建消息
          messageIndex = startStreamingMessage()
        }
        streamingContent += chunk
        // 清理評估標籤後顯示內容
        const cleanContent = cleanAIResponse(streamingContent)
        updateStreamingMessage(cleanContent)
        scrollToBottom()
      })
      
      // 調用流式API - 使用有效消息（排除被刪除的消息）
      const validMessages = promptStore.getValidMessages()
      console.log('[ChatInterface] Valid messages from store:', {
        count: validMessages.length,
        messages: validMessages.map(msg => ({
          type: msg.type,
          hasAttachments: !!(msg.attachments && msg.attachments.length > 0),
          attachmentCount: msg.attachments?.length || 0,
          attachments: msg.attachments?.map(att => ({ name: att.name, type: att.type, size: att.size }))
        }))
      })
      
      const conversationHistory = validMessages.map(msg => ({
        type: msg.type,
        content: msg.content,
        attachments: msg.attachments || []
      }))
      
      console.log('[ChatInterface] Conversation history for AI service:', {
        count: conversationHistory.length,
        withAttachments: conversationHistory.filter(msg => msg.attachments && msg.attachments.length > 0).length,
        details: conversationHistory.map(msg => ({
          type: msg.type,
          hasAttachments: !!(msg.attachments && msg.attachments.length > 0),
          attachmentCount: msg.attachments?.length || 0
        }))
      })
      
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '', // 用戶消息已在validMessages中，避免重複
        conversationHistory,
        provider,
        model.id,
        useStreamMode
      )

      // 清理流式回調
      aiService.clearStreamUpdateCallback()

      // 如果是流式模式但沒有通過回調更新消息（可能是降級到非流式）
      if (useStreamMode && messageIndex === -1) {
        console.log('[ChatInterface] Stream mode fallback detected, updating message directly')
        // 直接更新消息，因爲流式回調沒有被觸發
        messageIndex = startStreamingMessage()
        const cleanContent = cleanAIResponse(aiResponse)
        updateStreamingMessage(cleanContent)
      } else if (useStreamMode && streamingContent.trim() === '') {
        console.log('[ChatInterface] Stream mode with empty content, updating with final response')
        // 流式回調被觸發但內容爲空，使用最終響應
        const cleanContent = cleanAIResponse(aiResponse)
        updateStreamingMessage(cleanContent)
      }

      // AI智能判斷檢測
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基於我們的對話，我現在爲您生成需求報告：')) {
        setTimeout(async () => {
          // 使用全局模型生成提示詞，不使用AI助手專用模型
          const globalProvider = settingsStore.getCurrentProvider()
          const globalModel = settingsStore.getCurrentModel()
          if (globalProvider && globalModel) {
            await generatePrompt(globalProvider, globalModel.id)
          }
        }, 800)
      }
    } else {
      // 非流式模式 - 使用有效消息（排除被刪除的消息）
      const validMessages = promptStore.getValidMessages()
      const conversationHistory = validMessages.map(msg => ({
        type: msg.type,
        content: msg.content,
        attachments: msg.attachments || []
      }))
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '', // 用戶消息已在validMessages中，避免重複
        conversationHistory,
        provider,
        model.id,
        useStreamMode
      )

      // AI智能判斷檢測
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基於我們的對話，我現在爲您生成需求報告：')) {
        // 清理響應中的評估標籤，只顯示用戶可見內容
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
        
        setTimeout(async () => {
          // 使用全局模型生成提示詞，不使用AI助手專用模型
          const globalProvider = settingsStore.getCurrentProvider()
          const globalModel = settingsStore.getCurrentModel()
          if (globalProvider && globalModel) {
            await generatePrompt(globalProvider, globalModel.id)
          }
        }, 800)
      } else {
        // 正常回復 - 清理評估標籤
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
      }
    }
  } catch (error: unknown) {
    promptStore.isTyping = false // 重置思考狀態
    promptStore.isGenerating = false
    const errorMessage = error instanceof Error ? error.message : String(error)
    notificationStore.error(`發生錯誤: ${errorMessage}`)
    
    // 清理流式回調（如果是流式模式）
    if (isStreamMode.value) {
      const aiService = AIService.getInstance()
      aiService.clearStreamUpdateCallback()
    }
  }
}


// 生成提示詞
const generatePrompt = async (provider: any, modelId: string) => {
  try {

    // 生成需求報告 - 使用有效消息（排除被刪除的消息）
    const validMessages = promptStore.getValidMessages()
    const conversationHistory = validMessages.map(msg => ({
      type: msg.type,
      content: msg.content
    }))
    
    // 步驟0: 生成需求報告
    promptStore.isGenerating = true
    promptStore.currentExecutionStep = 'report'
    promptStore.addOrUpdateProgressMessage('🔄 正在基於對話生成需求報告...', 'progress')
    
    // 初始化空的需求報告，準備流式更新
    promptStore.promptData.requirementReport = ''
    
    // 設置流式回調函數
    const onReportStreamUpdate = (chunk: string) => {
      promptStore.promptData.requirementReport += chunk
    }
    
    const requirementReport = await aiGuideService.generateRequirementReportFromConversation(
      conversationHistory,
      provider,
      modelId,
      onReportStreamUpdate
    )
    
    // 最終確保數據正確性
    promptStore.promptData.requirementReport = requirementReport
    promptStore.showPreview = true // 立即顯示預覽面板
    
    // 檢查執行模式
    if (promptStore.isAutoMode) {
      // 自動模式：執行完整流程
      promptStore.addOrUpdateProgressMessage('✅ 需求報告已生成！正在自動執行完整的提示詞生成流程...', 'progress')
      
      // 導入PromptGeneratorService
      const promptGeneratorService = PromptGeneratorService.getInstance()
      
      // 步驟1: 獲取關鍵指令
      promptStore.currentExecutionStep = 'thinking'
      promptStore.addOrUpdateProgressMessage('🔄 步驟 1/4: 正在分析需求並生成關鍵指令...', 'progress')
      const thinkingPoints = await promptGeneratorService.getSystemPromptThinkingPoints(
        requirementReport,
        modelId,
        'zh',
        [],
        provider
      )
      
      promptStore.promptData.thinkingPoints = thinkingPoints
      
      // 步驟2: 生成初始提示詞
      promptStore.currentExecutionStep = 'initial'
      promptStore.addOrUpdateProgressMessage('🔄 步驟 2/4: 正在基於關鍵指令生成初始提示詞...', 'progress')
      const initialPrompt = await promptGeneratorService.generateSystemPrompt(
        requirementReport,
        modelId,
        'zh',
        [],
        thinkingPoints,
        provider
      )
      
      promptStore.promptData.initialPrompt = initialPrompt
      
      // 步驟3: 獲取優化建議
      promptStore.currentExecutionStep = 'advice'
      promptStore.addOrUpdateProgressMessage('🔄 步驟 3/4: 正在分析提示詞並生成優化建議...', 'progress')
      const advice = await promptGeneratorService.getOptimizationAdvice(
        initialPrompt,
        'system',
        modelId,
        'zh',
        [],
        provider
      )
      
      promptStore.promptData.advice = advice
      
      // 步驟4: 生成最終提示詞
      promptStore.currentExecutionStep = 'final'
      promptStore.addOrUpdateProgressMessage('🔄 步驟 4/4: 正在應用優化建議，生成最終提示詞...', 'progress')
      const finalPrompt = await promptGeneratorService.applyOptimizationAdvice(
        initialPrompt,
        advice,
        'system',
        modelId,
        'zh',
        [],
        provider
      )
      
      // 保存最終結果
      promptStore.promptData.generatedPrompt = finalPrompt
      promptStore.addOrUpdateProgressMessage('✅ 已爲您生成高質量的AI提示詞！右側可查看完整的生成過程和最終結果。', 'progress')
      
    } else {
      // 手動模式：只生成需求報告，等待用戶手動操作
      promptStore.addOrUpdateProgressMessage('✅ 需求報告已生成！請在右側預覽面板中查看，您可以手動執行每個步驟。', 'progress')
    }
    
    promptStore.isGenerating = false
    promptStore.currentExecutionStep = null
    
  } catch (error: unknown) {
    promptStore.isGenerating = false
    promptStore.currentExecutionStep = null
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    notificationStore.error(`提示詞生成失敗: ${errorMessage}。請檢查網絡連接和API配置後重試`)
  }
}

// 清空對話重新開始（複用初始化邏輯）
const clearChat = () => {
  promptStore.clearChat()
  showQuickReplies.value = false // 重置快速回復狀態
  
  // 清空文件上傳
  currentAttachments.value = []
  
  // 複用初始化邏輯
  setTimeout(async () => {
    await simulateTyping(config.welcomeMessage, false)
    promptStore.isInitialized = true
  }, 500)
}

// 文件上傳相關方法
// 觸發文件選擇
const triggerFileSelect = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

// 處理文件選擇
const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  
  if (files.length > 0) {
    try {
      const { processFiles } = await import('@/utils/fileUtils')
      const result = await processFiles(files)
      
      if (result.attachments.length > 0) {
        currentAttachments.value.push(...result.attachments)
      }
      
      if (result.errors.length > 0) {
        result.errors.forEach(error => notificationStore.error(error))
      }
    } catch (error) {
      notificationStore.error('文件處理失敗')
    }
    
    // 清空input值，允許重複選擇相同文件
    target.value = ''
  }
}

// 移除附件
const removeAttachment = (attachmentId: string) => {
  const index = currentAttachments.value.findIndex(att => att.id === attachmentId)
  if (index !== -1) {
    currentAttachments.value.splice(index, 1)
  }
}

// 全局拖拽處理方法
const handleGlobalDragEnter = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer?.items) {
    // 檢查是否包含文件
    for (let i = 0; i < event.dataTransfer.items.length; i++) {
      if (event.dataTransfer.items[i].kind === 'file') {
        isGlobalDragging.value = true
        break
      }
    }
  }
}

const handleGlobalDragOver = (event: DragEvent) => {
  event.preventDefault()
  isGlobalDragging.value = true
}

const handleGlobalDragLeave = (event: DragEvent) => {
  event.preventDefault()
  // 檢查是否真的離開了整個聊天區域
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY
  
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isGlobalDragging.value = false
  }
}

const handleGlobalDrop = async (event: DragEvent) => {
  event.preventDefault()
  isGlobalDragging.value = false
  
  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length > 0) {
    // 處理文件
    try {
      const { processFiles } = await import('@/utils/fileUtils')
      const result = await processFiles(files)
      
      if (result.attachments.length > 0) {
        currentAttachments.value.push(...result.attachments)
      }
      
      if (result.errors.length > 0) {
        result.errors.forEach(error => notificationStore.error(error))
      }
    } catch (error) {
      notificationStore.error('文件處理失敗')
    }
  }
}

// 輸入法組合事件處理
const handleCompositionStart = () => {
  isComposing.value = true
}

const handleCompositionEnd = () => {
  isComposing.value = false
}

// 鍵盤事件
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      // Shift + Enter: 換行
      return // 讓默認行爲發生（換行）
    } else {
      // Enter: 發送消息
      // 如果正在使用輸入法組合，不發送消息
      if (isComposing.value) {
        return
      }
      event.preventDefault()
      sendMessage()
    }
  }
}

// 消息操作方法
const setEditTextareaRef = (messageId: string, el: HTMLTextAreaElement | null) => {
  if (el) {
    editTextareaRefs.value[messageId] = el
  }
}

const startEdit = (messageId: string) => {
  const message = promptStore.chatMessages.find(msg => msg.id === messageId)
  if (message) {
    editingContent.value[messageId] = message.content
    promptStore.startEditMessage(messageId)
    
    // 下一幀聚焦到編輯框
    nextTick(() => {
      const textarea = editTextareaRefs.value[messageId]
      if (textarea) {
        textarea.focus()
        textarea.select()
      }
    })
  }
}

const saveEdit = (messageId: string) => {
  const newContent = editingContent.value[messageId]
  if (newContent !== undefined && newContent.trim()) {
    promptStore.saveEditMessage(messageId, newContent)
    delete editingContent.value[messageId]
    delete editTextareaRefs.value[messageId]
  } else {
    notificationStore.warning('消息內容不能爲空')
  }
}

const cancelEdit = (messageId: string) => {
  promptStore.cancelEditMessage(messageId)
  delete editingContent.value[messageId]
  delete editTextareaRefs.value[messageId]
}

const deleteMessage = (messageId: string) => {
  if (confirm('確定要刪除這條消息嗎？刪除後該消息將不會在後續的AI對話中被考慮。')) {
    promptStore.deleteMessage(messageId)
    notificationStore.success('消息已刪除')
  }
}

const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    notificationStore.success('已複製到剪貼板')
  } catch (error) {
    // 降級方案
    const textArea = document.createElement('textarea')
    textArea.value = content
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      notificationStore.success('已複製到剪貼板')
    } catch (fallbackError) {
      notificationStore.error('複製失敗，請手動選擇複製')
    }
    document.body.removeChild(textArea)
  }
}

const regenerateMessage = async (messageId: string, messageIndex: number) => {
  const message = promptStore.chatMessages.find(msg => msg.id === messageId)
  if (!message || message.type !== 'ai') {
    return
  }

  // 檢查是否配置了AI模型
  const { provider, model } = getCurrentChatModel()
  
  if (!provider || !model) {
    notificationStore.warning('請先在右上角設置中配置AI模型和API密鑰')
    return
  }

  try {
    // 獲取該消息之前的所有有效消息作爲上下文
    const contextMessages = promptStore.getValidMessages().slice(0, messageIndex)
    const conversationHistory = contextMessages.map(msg => ({
      type: msg.type,
      content: msg.content,
      attachments: msg.attachments || []
    }))
    
    // 開始重新生成
    promptStore.isTyping = true
    
    if (isStreamMode.value) {
      // 流式模式重新生成
      const aiService = AIService.getInstance()
      
      let streamingContent = ''
      
      // 設置流式回調函數
      aiService.setStreamUpdateCallback((chunk: string) => {
        streamingContent += chunk
        const cleanContent = cleanAIResponse(streamingContent)
        promptStore.updateMessage(messageId, cleanContent)
        scrollToBottom()
      })
      
      // 調用流式API
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '', // 用戶消息已在contextMessages中
        conversationHistory,
        provider,
        model.id,
        true
      )

      // 清理流式回調
      aiService.clearStreamUpdateCallback()
      
      // 確保最終內容正確
      const finalContent = cleanAIResponse(aiResponse)
      promptStore.updateMessage(messageId, finalContent)
      
    } else {
      // 非流式模式重新生成
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '',
        conversationHistory,
        provider,
        model.id,
        false
      )
      
      const cleanResponse = cleanAIResponse(aiResponse)
      promptStore.updateMessage(messageId, cleanResponse)
    }
    
    promptStore.isTyping = false
    notificationStore.success('消息已重新生成')
    
  } catch (error: unknown) {
    promptStore.isTyping = false
    const errorMessage = error instanceof Error ? error.message : String(error)
    notificationStore.error(`重新生成失敗: ${errorMessage}`)
    
    // 清理流式回調（如果是流式模式）
    if (isStreamMode.value) {
      const aiService = AIService.getInstance()
      aiService.clearStreamUpdateCallback()
    }
  }
}

const resendMessage = async (messageId: string) => {
  const message = promptStore.chatMessages.find(msg => msg.id === messageId)
  if (!message || message.type !== 'user') {
    return
  }

  // 檢查是否配置了AI模型
  const { provider, model } = getCurrentChatModel()
  
  if (!provider || !model) {
    notificationStore.warning('請先在右上角設置中配置AI模型和API密鑰')
    return
  }

  // 先保存編輯
  const newContent = editingContent.value[messageId]
  if (newContent !== undefined && newContent.trim()) {
    promptStore.saveEditMessage(messageId, newContent)
    delete editingContent.value[messageId]
    delete editTextareaRefs.value[messageId]
    
    // 刪除該用戶消息之後的所有消息（包括AI回覆）
    const messageIndex = promptStore.chatMessages.findIndex(msg => msg.id === messageId)
    if (messageIndex !== -1) {
      // 標記後續消息爲刪除狀態
      for (let i = messageIndex + 1; i < promptStore.chatMessages.length; i++) {
        const msg = promptStore.chatMessages[i]
        if (msg && !msg.isProgress) {
          promptStore.deleteMessage(msg.id!)
        }
      }
    }

    // 重新發送消息，觸發AI回覆
    try {
      // 立即顯示AI正在思考的狀態
      promptStore.isTyping = true

      // 根據用戶設置使用流式或非流式模式
      const useStreamMode = isStreamMode.value
      
      if (useStreamMode) {
        // 流式模式
        const aiService = AIService.getInstance()
        
        // 準備流式顯示
        let streamingContent = ''
        let messageIndex = -1
        
        // 設置流式回調函數
        aiService.setStreamUpdateCallback((chunk: string) => {
          if (messageIndex === -1) {
            // 第一次收到數據，創建消息
            messageIndex = startStreamingMessage()
          }
          streamingContent += chunk
          // 清理評估標籤後顯示內容
          const cleanContent = cleanAIResponse(streamingContent)
          updateStreamingMessage(cleanContent)
          scrollToBottom()
        })
        
        // 獲取有效消息並調用API
        const validMessages = promptStore.getValidMessages()
        const conversationHistory = validMessages.map(msg => ({
          type: msg.type,
          content: msg.content,
          attachments: msg.attachments || []
        }))
        const aiResponse = await aiGuideService.generateSimpleResponse(
          '',
          conversationHistory,
          provider,
          model.id,
          useStreamMode
        )

        // 清理流式回調
        aiService.clearStreamUpdateCallback()

        // AI智能判斷檢測
        const shouldEndConversation = checkAIDecision(aiResponse)
        
        if (shouldEndConversation || aiResponse.includes('基於我們的對話，我現在爲您生成需求報告：')) {
          setTimeout(async () => {
            // 使用全局模型生成提示詞，不使用AI助手專用模型
          const globalProvider = settingsStore.getCurrentProvider()
          const globalModel = settingsStore.getCurrentModel()
          if (globalProvider && globalModel) {
            await generatePrompt(globalProvider, globalModel.id)
          }
          }, 800)
        }
      } else {
        // 非流式模式
        const validMessages = promptStore.getValidMessages()
        const conversationHistory = validMessages.map(msg => ({
          type: msg.type,
          content: msg.content,
          attachments: msg.attachments || []
        }))
        const aiResponse = await aiGuideService.generateSimpleResponse(
          '',
          conversationHistory,
          provider,
          model.id,
          useStreamMode
        )

        // AI智能判斷檢測
        const shouldEndConversation = checkAIDecision(aiResponse)
        
        if (shouldEndConversation || aiResponse.includes('基於我們的對話，我現在爲您生成需求報告：')) {
          // 清理響應中的評估標籤，只顯示用戶可見內容
          const cleanResponse = cleanAIResponse(aiResponse)
          await simulateTyping(cleanResponse, false)
          
          setTimeout(async () => {
            // 使用全局模型生成提示詞，不使用AI助手專用模型
          const globalProvider = settingsStore.getCurrentProvider()
          const globalModel = settingsStore.getCurrentModel()
          if (globalProvider && globalModel) {
            await generatePrompt(globalProvider, globalModel.id)
          }
          }, 800)
        } else {
          // 正常回復 - 清理評估標籤
          const cleanResponse = cleanAIResponse(aiResponse)
          await simulateTyping(cleanResponse, false)
        }
      }
      
      notificationStore.success('消息已重新發送')
      
    } catch (error: unknown) {
      promptStore.isTyping = false
      promptStore.isGenerating = false
      const errorMessage = error instanceof Error ? error.message : String(error)
      notificationStore.error(`重新發送失敗: ${errorMessage}`)
      
      // 清理流式回調（如果是流式模式）
      if (isStreamMode.value) {
        const aiService = AIService.getInstance()
        aiService.clearStreamUpdateCallback()
      }
    }
  } else {
    notificationStore.warning('消息內容不能爲空')
  }
}

// 重新發送用戶消息（新方法，清理後續消息）
const resendUserMessage = async (messageId: string, messageIndex: number) => {
  const message = promptStore.chatMessages.find(msg => msg.id === messageId)
  if (!message || message.type !== 'user') {
    return
  }

  // 檢查是否配置了AI模型
  const { provider, model } = getCurrentChatModel()
  
  if (!provider || !model) {
    notificationStore.warning('請先在右上角設置中配置AI模型和API密鑰')
    return
  }

  try {
    // 刪除該用戶消息之後的所有消息（包括AI回覆）
    if (messageIndex !== -1) {
      // 標記後續消息爲刪除狀態
      for (let i = messageIndex + 1; i < promptStore.chatMessages.length; i++) {
        const msg = promptStore.chatMessages[i]
        if (msg && !msg.isProgress) {
          promptStore.deleteMessage(msg.id!)
        }
      }
    }

    // 重新發送消息，觸發AI回覆
    // 立即顯示AI正在思考的狀態
    promptStore.isTyping = true

    // 根據用戶設置使用流式或非流式模式
    const useStreamMode = isStreamMode.value
    
    if (useStreamMode) {
      // 流式模式
      const aiService = AIService.getInstance()
      
      // 準備流式顯示
      let streamingContent = ''
      let messageIndex = -1
      
      // 設置流式回調函數
      aiService.setStreamUpdateCallback((chunk: string) => {
        if (messageIndex === -1) {
          // 第一次收到數據，創建消息
          messageIndex = startStreamingMessage()
        }
        streamingContent += chunk
        // 清理評估標籤後顯示內容
        const cleanContent = cleanAIResponse(streamingContent)
        updateStreamingMessage(cleanContent)
        scrollToBottom()
      })
      
      // 獲取有效消息並調用API
      const validMessages = promptStore.getValidMessages()
      const conversationHistory = validMessages.map(msg => ({
        type: msg.type,
        content: msg.content,
        attachments: msg.attachments || []
      }))
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '',
        conversationHistory,
        provider,
        model.id,
        useStreamMode
      )

      // 清理流式回調
      aiService.clearStreamUpdateCallback()

      // AI智能判斷檢測
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基於我們的對話，我現在爲您生成需求報告：')) {
        setTimeout(async () => {
          // 使用全局模型生成提示詞，不使用AI助手專用模型
          const globalProvider = settingsStore.getCurrentProvider()
          const globalModel = settingsStore.getCurrentModel()
          if (globalProvider && globalModel) {
            await generatePrompt(globalProvider, globalModel.id)
          }
        }, 800)
      }
    } else {
      // 非流式模式
      const validMessages = promptStore.getValidMessages()
      const conversationHistory = validMessages.map(msg => ({
        type: msg.type,
        content: msg.content,
        attachments: msg.attachments || []
      }))
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '',
        conversationHistory,
        provider,
        model.id,
        useStreamMode
      )

      // AI智能判斷檢測
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基於我們的對話，我現在爲您生成需求報告：')) {
        // 清理響應中的評估標籤，只顯示用戶可見內容
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
        
        setTimeout(async () => {
          // 使用全局模型生成提示詞，不使用AI助手專用模型
          const globalProvider = settingsStore.getCurrentProvider()
          const globalModel = settingsStore.getCurrentModel()
          if (globalProvider && globalModel) {
            await generatePrompt(globalProvider, globalModel.id)
          }
        }, 800)
      } else {
        // 正常回復 - 清理評估標籤
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
      }
    }
    
    notificationStore.success('消息已重新發送')
    
  } catch (error: unknown) {
    promptStore.isTyping = false
    promptStore.isGenerating = false
    const errorMessage = error instanceof Error ? error.message : String(error)
    notificationStore.error(`重新發送失敗: ${errorMessage}`)
    
    // 清理流式回調（如果是流式模式）
    if (isStreamMode.value) {
      const aiService = AIService.getInstance()
      aiService.clearStreamUpdateCallback()
    }
  }
}

const handleEditKeydown = (event: KeyboardEvent, messageId: string) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault()
    saveEdit(messageId)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit(messageId)
  }
}
</script>