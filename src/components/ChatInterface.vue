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
        <div>
          <h2 class="font-semibold text-gray-800">AI助手对话</h2>
        </div>
        <div class="flex items-center space-x-3">
          <!-- 移动端折叠按钮 -->
          <button
            v-if="isMobile && isExpanded"
            @click="$emit('toggle')"
            class="p-1 hover:bg-gray-100 rounded transition-colors"
            title="折叠"
          >
            <ChevronUp class="w-5 h-5 text-gray-500" />
          </button>
          
          <!-- 流式开关 -->
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
              :title="isStreamMode ? '关闭流式模式' : '开启流式模式'"
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
            重新开始
          </button>
        </div>
      </div>
    </div>

    <!-- Chat Messages - 可滚动区域 -->
    <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" :style="{ maxHeight: shouldShowQuickReplies ? 'calc(100vh - 420px)' : 'calc(100vh - 340px)' }">
      <div
        v-for="(message, index) in promptStore.chatMessages.filter(msg => !msg.isDeleted)"
        :key="message.id || index"
        :class="message.type === 'user' ? 'justify-end' : 'justify-start'"
        class="flex group"
      >
        <div class="flex flex-col w-full" :class="message.isEditing ? 'max-w-2xl' : 'max-w-xs lg:max-w-md'">
          <!-- 消息内容 -->
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
            <!-- 编辑模式 -->
            <div v-if="message.isEditing" class="space-y-3">
              <div class="text-sm text-gray-600 font-medium mb-2">
                编辑{{ message.type === 'user' ? '用户' : 'AI' }}消息
              </div>
              <textarea
                :ref="(el: any) => setEditTextareaRef(message.id!, el as HTMLTextAreaElement)"
                v-model="editingContent[message.id!]"
                class="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 bg-white min-h-[120px] max-h-[300px] overflow-y-auto"
                @keydown="handleEditKeydown($event, message.id!)"
                placeholder="编辑消息内容..."
              ></textarea>
              <div class="text-xs text-gray-500 mt-1">
                快捷键：Ctrl+Enter 保存，Escape 取消
              </div>
            </div>
            
            <!-- 正常显示模式 -->
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
          
          <!-- 附件列表显示 -->
          <div 
            v-if="message.attachments && message.attachments.length > 0 && !message.isEditing"
            class="mt-2"
            :class="message.type === 'user' ? 'ml-auto max-w-xs lg:max-w-md' : 'mr-auto max-w-xs lg:max-w-md'"
          >
            <div class="text-xs text-gray-500 mb-1">附件 ({{ message.attachments.length }})</div>
            <!-- 横向滑动容器 -->
            <div class="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-1">
              <div
                v-for="attachment in message.attachments"
                :key="attachment.id"
                class="flex-shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border min-w-0"
                :class="message.type === 'user' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-100'"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <!-- 文件图标 -->
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
          
          <!-- 消息操作按钮 -->
          <div 
            v-if="!message.isProgress"
            class="flex space-x-1 mt-2 transition-opacity duration-200"
            :class="[
              message.isEditing 
                ? 'opacity-100 justify-center' 
                : 'opacity-0 group-hover:opacity-100 ' + (message.type === 'user' ? 'justify-end' : 'justify-start')
            ]"
          >
            <!-- 编辑状态下的按钮 -->
            <template v-if="message.isEditing">
              <button
                @click="saveEdit(message.id!)"
                class="flex items-center space-x-1 px-3 py-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors rounded-lg border border-green-200"
                title="保存编辑 (Ctrl+Enter)"
              >
                <Check class="w-4 h-4" />
                <span class="text-sm font-medium">保存</span>
              </button>
              
              <button
                v-if="message.type === 'user'"
                @click="resendMessage(message.id!)"
                class="flex items-center space-x-1 px-3 py-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors rounded-lg border border-blue-200"
                title="保存并重新发送"
                :disabled="promptStore.isTyping || promptStore.isGenerating"
              >
                <Send class="w-4 h-4" />
                <span class="text-sm font-medium">重新发送</span>
              </button>
              
              <button
                @click="cancelEdit(message.id!)"
                class="flex items-center space-x-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-colors rounded-lg border border-gray-200"
                title="取消编辑 (Escape)"
              >
                <X class="w-4 h-4" />
                <span class="text-sm font-medium">取消</span>
              </button>
            </template>
            
            <!-- 正常状态下的按钮 -->
            <template v-else>
              <!-- 重新生成按钮（仅AI消息） -->
              <button
                v-if="message.type === 'ai'"
                @click="regenerateMessage(message.id!, index)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="重新生成回复"
                :disabled="promptStore.isTyping || promptStore.isGenerating"
              >
                <RefreshCw class="w-3.5 h-3.5" />
              </button>
              
              <!-- 重新发送按钮（仅用户消息） -->
              <button
                v-if="message.type === 'user'"
                @click="resendUserMessage(message.id!, index)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="重新发送消息"
                :disabled="promptStore.isTyping || promptStore.isGenerating"
              >
                <Send class="w-3.5 h-3.5" />
              </button>
              
              <!-- 编辑按钮 -->
              <button
                @click="startEdit(message.id!)"
                class="p-1.5 text-gray-500 hover:text-green-600 transition-colors rounded-lg hover:bg-gray-100"
                title="编辑消息"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </button>
              
              <!-- 删除按钮 -->
              <button
                @click="deleteMessage(message.id!)"
                class="p-1.5 text-gray-500 hover:text-red-600 transition-colors rounded-lg hover:bg-gray-100"
                title="删除消息"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
              
              <!-- 复制按钮 -->
              <button
                @click="copyMessage(message.content)"
                class="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100"
                title="复制消息内容"
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

    <!-- 快速回复选项 - 在输入区域内部 -->
    <div v-if="shouldShowQuickReplies" class="px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
      <div class="text-xs text-gray-500 mb-2">快速回复：</div>
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
      <!-- 隐藏的文件输入控件 -->
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,.java,.c,.cpp,.yaml,.yml"
        @change="handleFileSelect"
        class="hidden"
      />
      
      <!-- 附件预览区域（紧凑横向滑动） -->
      <div v-if="currentAttachments.length > 0" class="mb-3 p-3 bg-gray-50 rounded-lg">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-gray-600">已选择 {{ currentAttachments.length }} 个附件</span>
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
              <!-- 文件图标 -->
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
            <!-- 移除按钮 -->
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
      
      <!-- 输入框容器 - 真正的分区设计 -->
      <div class="relative border border-gray-300 rounded-2xl focus-within:outline-none focus-within:border-gray-300 overflow-hidden" style="height: 120px;">
        <!-- 文字输入区域容器 - 固定高度，为按钮预留空间 -->
        <div class="absolute top-0 left-0 right-0" style="bottom: 48px;">
          <textarea
            ref="textareaRef"
            v-model="userInput"
            @keydown="handleKeydown"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
            @input="adjustTextareaHeight"
            @focus="showQuickReplies = true"
            :placeholder="shouldShowQuickReplies ? '输入或点击上方快速回复...' : 'Shift+Enter换行'"
            :disabled="promptStore.isTyping || promptStore.isGenerating"
            class="w-full h-full px-2 pt-3 pb-1 border-0 outline-none resize-none disabled:opacity-50 text-base overflow-y-auto bg-transparent"
            rows="1"
          ></textarea>
        </div>
        
        <!-- 按钮专用区域 - 固定在底部48px -->
        <div class="absolute bottom-0 left-0 right-0 h-12 flex justify-between items-center px-2 bg-transparent pointer-events-none">
          <!-- 附件按钮 -->
          <button
            @click="triggerFileSelect"
            class="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center justify-center pointer-events-auto"
            title="支持拖拽上传图片、文档、音频等格式，单个文件最大25MB"
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
          
          <!-- 发送按钮 -->
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
    
    <!-- 全局拖拽覆盖层 -->
    <div
      v-if="isGlobalDragging"
      class="absolute inset-0 bg-blue-50 bg-opacity-90 flex items-center justify-center z-50 border-2 border-dashed border-blue-400 rounded-lg"
    >
      <div class="text-center">
        <Upload class="w-12 h-12 mx-auto mb-4 text-blue-500" />
        <div class="text-lg font-medium text-blue-700 mb-2">
          释放文件以上传
        </div>
        <div class="text-sm text-blue-600">
          支持图片、文档、音频等格式
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

// 解构props以避免未使用警告
const { isMobile, isExpanded } = props

// 模块配置（便于将来封装）
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

// 文件上传相关状态
const currentAttachments = ref<MessageAttachment[]>([])
const isGlobalDragging = ref(false)

// 编辑相关状态
const editingContent = ref<Record<string, string>>({})
const editTextareaRefs = ref<Record<string, HTMLTextAreaElement | null>>({})

// 流式模式状态
const isStreamMode = ref(true) // 默认开启流式模式

// 输入法组合状态
const isComposing = ref(false)

// 自动调整textarea高度 - 简化版本，因为高度现在由容器控制
const adjustTextareaHeight = () => {
  // 高度现在由容器的 CSS 控制，不需要动态调整
  // 保持这个函数是为了兼容性
}

// 快速回复功能
const showQuickReplies = ref(false)

// 动态计算快捷回复选项，强制触发选项只在第6轮对话后显示（3轮用户输入后）
const quickReplies = computed(() => {
  const messageCount = promptStore.chatMessages.length
  const baseReplies = ['请使用相关最佳实践的推荐建议']
  
  // 如果对话轮数大于等于6（表示至少3轮用户输入），添加强制触发选项
  if (messageCount >= 6) {
    return [...baseReplies, '强制生成需求报告']
  }
  
  return baseReplies
})

// 检查是否为强制触发关键词
const checkForceGenerate = (userInput: string): boolean => {
  const forceKeywords = ['强制生成需求报告']
  return forceKeywords.some(keyword => userInput.includes(keyword))
}

// 切换流式模式
const toggleStreamMode = () => {
  isStreamMode.value = !isStreamMode.value
  // 可以选择将状态保存到本地存储
  localStorage.setItem('yprompt_stream_mode', JSON.stringify(isStreamMode.value))
}

// 计算是否应该显示快捷回复（从第二个问题开始）
const shouldShowQuickReplies = computed(() => {
  // 对话消息数大于2（AI初始问题 + 用户第一次回答）时才显示快捷回复
  return promptStore.chatMessages.length >= 2 && showQuickReplies.value
})

// 点击外部区域隐藏快捷回复
const handleClickOutside = (event: MouseEvent) => {
  if (inputContainer.value && !inputContainer.value.contains(event.target as Node)) {
    showQuickReplies.value = false
  }
}

// Markdown渲染函数
const renderMarkdown = (content: string): string => {
  try {
    const result = marked(content, {
      breaks: true,
      gfm: true
    })
    // 确保返回字符串类型
    return typeof result === 'string' ? result : String(result)
  } catch (error) {
    return content // 降级为纯文本
  }
}

// 用户消息渲染函数 - 支持换行和基础markdown
const renderUserMessage = (content: string): string => {
  try {
    // 检查是否包含明显的markdown语法
    const hasMarkdown = /^#|^\*\*|^##|^\*|^-|\*\*.*\*\*|^1\.|```/.test(content) || 
                       content.includes('**') || content.includes('##') || content.includes('# ')
    
    if (hasMarkdown || content.length > 50) { // 长文本默认用markdown渲染
      // 使用markdown渲染
      const result = marked(content, {
        breaks: true,
        gfm: true
      })
      return typeof result === 'string' ? result : String(result)
    } else {
      // 简单文本只处理换行符
      return content.replace(/\n/g, '<br>')
    }
  } catch (error) {
    // 错误时使用markdown渲染作为兜底
    try {
      const result = marked(content, { breaks: true, gfm: true })
      return typeof result === 'string' ? result : String(result)
    } catch {
      return content.replace(/\n/g, '<br>')
    }
  }
}

// 初始化对话（模块化设计）
const initializeChat = async () => {
  // 加载流式模式设置
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

// 挂载和卸载事件监听器
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // 初始化对话
  initializeChat()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 选择快速回复
const selectQuickReply = (reply: string) => {
  userInput.value = reply
  showQuickReplies.value = false
  sendMessage()
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// 监听消息变化，自动滚动
watch(() => promptStore.chatMessages.length, scrollToBottom)
watch(() => promptStore.isTyping, scrollToBottom)

// 流式消息显示
let currentStreamingMessageIndex = -1

// 开始流式消息显示
const startStreamingMessage = () => {
  promptStore.isTyping = false // 停止thinking状态
  promptStore.addMessage('ai', '', undefined)
  currentStreamingMessageIndex = promptStore.chatMessages.length - 1
  return currentStreamingMessageIndex
}

// 更新流式消息内容
const updateStreamingMessage = (content: string) => {
  if (currentStreamingMessageIndex >= 0 && currentStreamingMessageIndex < promptStore.chatMessages.length) {
    promptStore.chatMessages[currentStreamingMessageIndex].content = content
  }
}

// 模拟AI打字效果或流式显示
const simulateTyping = async (message: string, isStreaming: boolean = false) => {
  
  if (isStreaming) {
    // 流式显示：立即添加空消息，然后逐步更新
    const messageIndex = promptStore.chatMessages.length
    promptStore.addMessage('ai', '', undefined)
    
    // 逐字符显示效果
    for (let i = 0; i <= message.length; i++) {
      promptStore.chatMessages[messageIndex].content = message.substring(0, i)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10))
    }
  } else {
    // 非流式：先显示打字效果，然后显示完整消息
    promptStore.isTyping = true
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100))
    promptStore.isTyping = false
    promptStore.addMessage('ai', message, undefined)
  }
}

// 发送消息
const sendMessage = async () => {
  // 限制：必须有文本内容才能发送，不允许只发送附件
  if (!userInput.value.trim()) {
    if (currentAttachments.value.length > 0) {
      notificationStore.warning('请输入消息内容，不能只发送附件')
    }
    return
  }
  
  // 检查是否配置了AI模型
  const provider = settingsStore.getCurrentProvider()
  const model = settingsStore.getCurrentModel()
  
  if (!provider || !model) {
    notificationStore.warning('请先在右上角设置中配置AI模型和API密钥')
    return
  }

  const currentInput = userInput.value
  const attachments = [...currentAttachments.value]
  
  console.log('[ChatInterface] Sending message with attachments:', {
    hasInput: !!currentInput.trim(),
    attachmentCount: attachments.length,
    attachments: attachments.map(att => ({ name: att.name, type: att.type, size: att.size, hasData: !!att.data }))
  })
  
  // 检查是否为强制触发关键词
  const isForceGenerate = checkForceGenerate(currentInput)
  
  // 添加用户消息（包含附件）
  promptStore.addMessage('user', currentInput, attachments)
  
  // 清空输入和附件
  userInput.value = ''
  currentAttachments.value = []
  showQuickReplies.value = false // 发送后隐藏快速回复
  
  // 立即重置textarea高度到默认值
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = '80px'
  }
  
  // 如果是强制触发，直接生成需求报告
  if (isForceGenerate) {
    console.log('[ChatInterface] Force generate triggered by user input')
    // 显示确认消息
    await simulateTyping('好的，我将立即为您生成需求报告。', false)
    
    setTimeout(async () => {
      await generatePrompt(provider, model.id)
    }, 800)
    return
  }

  // 立即显示AI正在思考的状态
  promptStore.isTyping = true

  try {
    // 根据用户设置使用流式或非流式模式
    const useStreamMode = isStreamMode.value
    
    if (useStreamMode) {
      // 流式模式
      const aiService = AIService.getInstance()
      
      // 准备流式显示
      let streamingContent = ''
      let messageIndex = -1
      
      // 设置流式回调函数
      aiService.setStreamUpdateCallback((chunk: string) => {
        if (messageIndex === -1) {
          // 第一次收到数据，创建消息
          messageIndex = startStreamingMessage()
        }
        streamingContent += chunk
        // 清理评估标签后显示内容
        const cleanContent = cleanAIResponse(streamingContent)
        updateStreamingMessage(cleanContent)
        scrollToBottom()
      })
      
      // 调用流式API - 使用有效消息（排除被删除的消息）
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
        '', // 用户消息已在validMessages中，避免重复
        conversationHistory,
        provider,
        model.id,
        useStreamMode
      )

      // 清理流式回调
      aiService.clearStreamUpdateCallback()

      // 如果是流式模式但没有通过回调更新消息（可能是降级到非流式）
      if (useStreamMode && messageIndex === -1) {
        console.log('[ChatInterface] Stream mode fallback detected, updating message directly')
        // 直接更新消息，因为流式回调没有被触发
        messageIndex = startStreamingMessage()
        const cleanContent = cleanAIResponse(aiResponse)
        updateStreamingMessage(cleanContent)
      } else if (useStreamMode && streamingContent.trim() === '') {
        console.log('[ChatInterface] Stream mode with empty content, updating with final response')
        // 流式回调被触发但内容为空，使用最终响应
        const cleanContent = cleanAIResponse(aiResponse)
        updateStreamingMessage(cleanContent)
      }

      // AI智能判断检测
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基于我们的对话，我现在为您生成需求报告：')) {
        setTimeout(async () => {
          await generatePrompt(provider, model.id)
        }, 800)
      }
    } else {
      // 非流式模式 - 使用有效消息（排除被删除的消息）
      const validMessages = promptStore.getValidMessages()
      const conversationHistory = validMessages.map(msg => ({
        type: msg.type,
        content: msg.content,
        attachments: msg.attachments || []
      }))
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '', // 用户消息已在validMessages中，避免重复
        conversationHistory,
        provider,
        model.id,
        useStreamMode
      )

      // AI智能判断检测
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基于我们的对话，我现在为您生成需求报告：')) {
        // 清理响应中的评估标签，只显示用户可见内容
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
        
        setTimeout(async () => {
          await generatePrompt(provider, model.id)
        }, 800)
      } else {
        // 正常回复 - 清理评估标签
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
      }
    }
  } catch (error: unknown) {
    promptStore.isTyping = false // 重置思考状态
    promptStore.isGenerating = false
    const errorMessage = error instanceof Error ? error.message : String(error)
    notificationStore.error(`发生错误: ${errorMessage}`)
    
    // 清理流式回调（如果是流式模式）
    if (isStreamMode.value) {
      const aiService = AIService.getInstance()
      aiService.clearStreamUpdateCallback()
    }
  }
}


// 生成提示词
const generatePrompt = async (provider: any, modelId: string) => {
  try {

    // 生成需求报告 - 使用有效消息（排除被删除的消息）
    const validMessages = promptStore.getValidMessages()
    const conversationHistory = validMessages.map(msg => ({
      type: msg.type,
      content: msg.content
    }))
    
    // 步骤0: 生成需求报告
    promptStore.isGenerating = true
    promptStore.currentExecutionStep = 'report'
    promptStore.addOrUpdateProgressMessage('🔄 正在基于对话生成需求报告...', 'progress')
    
    // 初始化空的需求报告，准备流式更新
    promptStore.promptData.requirementReport = ''
    
    // 设置流式回调函数
    const onReportStreamUpdate = (chunk: string) => {
      promptStore.promptData.requirementReport += chunk
    }
    
    const requirementReport = await aiGuideService.generateRequirementReportFromConversation(
      conversationHistory,
      provider,
      modelId,
      onReportStreamUpdate
    )
    
    // 最终确保数据正确性
    promptStore.promptData.requirementReport = requirementReport
    promptStore.showPreview = true // 立即显示预览面板
    
    // 检查执行模式
    if (promptStore.isAutoMode) {
      // 自动模式：执行完整流程
      promptStore.addOrUpdateProgressMessage('✅ 需求报告已生成！正在自动执行完整的提示词生成流程...', 'progress')
      
      // 导入PromptGeneratorService
      const promptGeneratorService = PromptGeneratorService.getInstance()
      
      // 步骤1: 获取关键指令
      promptStore.currentExecutionStep = 'thinking'
      promptStore.addOrUpdateProgressMessage('🔄 步骤 1/4: 正在分析需求并生成关键指令...', 'progress')
      const thinkingPoints = await promptGeneratorService.getSystemPromptThinkingPoints(
        requirementReport,
        modelId,
        'zh',
        [],
        provider
      )
      
      promptStore.promptData.thinkingPoints = thinkingPoints
      
      // 步骤2: 生成初始提示词
      promptStore.currentExecutionStep = 'initial'
      promptStore.addOrUpdateProgressMessage('🔄 步骤 2/4: 正在基于关键指令生成初始提示词...', 'progress')
      const initialPrompt = await promptGeneratorService.generateSystemPrompt(
        requirementReport,
        modelId,
        'zh',
        [],
        thinkingPoints,
        provider
      )
      
      promptStore.promptData.initialPrompt = initialPrompt
      
      // 步骤3: 获取优化建议
      promptStore.currentExecutionStep = 'advice'
      promptStore.addOrUpdateProgressMessage('🔄 步骤 3/4: 正在分析提示词并生成优化建议...', 'progress')
      const advice = await promptGeneratorService.getOptimizationAdvice(
        initialPrompt,
        'system',
        modelId,
        'zh',
        [],
        provider
      )
      
      promptStore.promptData.advice = advice
      
      // 步骤4: 生成最终提示词
      promptStore.currentExecutionStep = 'final'
      promptStore.addOrUpdateProgressMessage('🔄 步骤 4/4: 正在应用优化建议，生成最终提示词...', 'progress')
      const finalPrompt = await promptGeneratorService.applyOptimizationAdvice(
        initialPrompt,
        advice,
        'system',
        modelId,
        'zh',
        [],
        provider
      )
      
      // 保存最终结果
      promptStore.promptData.generatedPrompt = finalPrompt
      promptStore.addOrUpdateProgressMessage('✅ 已为您生成高质量的AI提示词！右侧可查看完整的生成过程和最终结果。', 'progress')
      
    } else {
      // 手动模式：只生成需求报告，等待用户手动操作
      promptStore.addOrUpdateProgressMessage('✅ 需求报告已生成！请在右侧预览面板中查看，您可以手动执行每个步骤。', 'progress')
    }
    
    promptStore.isGenerating = false
    promptStore.currentExecutionStep = null
    
  } catch (error: unknown) {
    promptStore.isGenerating = false
    promptStore.currentExecutionStep = null
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    notificationStore.error(`提示词生成失败: ${errorMessage}。请检查网络连接和API配置后重试`)
  }
}

// 清空对话重新开始（复用初始化逻辑）
const clearChat = () => {
  promptStore.clearChat()
  showQuickReplies.value = false // 重置快速回复状态
  
  // 清空文件上传
  currentAttachments.value = []
  
  // 复用初始化逻辑
  setTimeout(async () => {
    await simulateTyping(config.welcomeMessage, false)
    promptStore.isInitialized = true
  }, 500)
}

// 文件上传相关方法
// 触发文件选择
const triggerFileSelect = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

// 处理文件选择
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
      notificationStore.error('文件处理失败')
    }
    
    // 清空input值，允许重复选择相同文件
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

// 全局拖拽处理方法
const handleGlobalDragEnter = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer?.items) {
    // 检查是否包含文件
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
  // 检查是否真的离开了整个聊天区域
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
    // 处理文件
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
      notificationStore.error('文件处理失败')
    }
  }
}

// 输入法组合事件处理
const handleCompositionStart = () => {
  isComposing.value = true
}

const handleCompositionEnd = () => {
  isComposing.value = false
}

// 键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      // Shift + Enter: 换行
      return // 让默认行为发生（换行）
    } else {
      // Enter: 发送消息
      // 如果正在使用输入法组合，不发送消息
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
    
    // 下一帧聚焦到编辑框
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
    notificationStore.warning('消息内容不能为空')
  }
}

const cancelEdit = (messageId: string) => {
  promptStore.cancelEditMessage(messageId)
  delete editingContent.value[messageId]
  delete editTextareaRefs.value[messageId]
}

const deleteMessage = (messageId: string) => {
  if (confirm('确定要删除这条消息吗？删除后该消息将不会在后续的AI对话中被考虑。')) {
    promptStore.deleteMessage(messageId)
    notificationStore.success('消息已删除')
  }
}

const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    notificationStore.success('已复制到剪贴板')
  } catch (error) {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = content
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      notificationStore.success('已复制到剪贴板')
    } catch (fallbackError) {
      notificationStore.error('复制失败，请手动选择复制')
    }
    document.body.removeChild(textArea)
  }
}

const regenerateMessage = async (messageId: string, messageIndex: number) => {
  const message = promptStore.chatMessages.find(msg => msg.id === messageId)
  if (!message || message.type !== 'ai') {
    return
  }

  // 检查是否配置了AI模型
  const provider = settingsStore.getCurrentProvider()
  const model = settingsStore.getCurrentModel()
  
  if (!provider || !model) {
    notificationStore.warning('请先在右上角设置中配置AI模型和API密钥')
    return
  }

  try {
    // 获取该消息之前的所有有效消息作为上下文
    const contextMessages = promptStore.getValidMessages().slice(0, messageIndex)
    const conversationHistory = contextMessages.map(msg => ({
      type: msg.type,
      content: msg.content,
      attachments: msg.attachments || []
    }))
    
    // 开始重新生成
    promptStore.isTyping = true
    
    if (isStreamMode.value) {
      // 流式模式重新生成
      const aiService = AIService.getInstance()
      
      let streamingContent = ''
      
      // 设置流式回调函数
      aiService.setStreamUpdateCallback((chunk: string) => {
        streamingContent += chunk
        const cleanContent = cleanAIResponse(streamingContent)
        promptStore.updateMessage(messageId, cleanContent)
        scrollToBottom()
      })
      
      // 调用流式API
      const aiResponse = await aiGuideService.generateSimpleResponse(
        '', // 用户消息已在contextMessages中
        conversationHistory,
        provider,
        model.id,
        true
      )

      // 清理流式回调
      aiService.clearStreamUpdateCallback()
      
      // 确保最终内容正确
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
    notificationStore.error(`重新生成失败: ${errorMessage}`)
    
    // 清理流式回调（如果是流式模式）
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

  // 检查是否配置了AI模型
  const provider = settingsStore.getCurrentProvider()
  const model = settingsStore.getCurrentModel()
  
  if (!provider || !model) {
    notificationStore.warning('请先在右上角设置中配置AI模型和API密钥')
    return
  }

  // 先保存编辑
  const newContent = editingContent.value[messageId]
  if (newContent !== undefined && newContent.trim()) {
    promptStore.saveEditMessage(messageId, newContent)
    delete editingContent.value[messageId]
    delete editTextareaRefs.value[messageId]
    
    // 删除该用户消息之后的所有消息（包括AI回复）
    const messageIndex = promptStore.chatMessages.findIndex(msg => msg.id === messageId)
    if (messageIndex !== -1) {
      // 标记后续消息为删除状态
      for (let i = messageIndex + 1; i < promptStore.chatMessages.length; i++) {
        const msg = promptStore.chatMessages[i]
        if (msg && !msg.isProgress) {
          promptStore.deleteMessage(msg.id!)
        }
      }
    }

    // 重新发送消息，触发AI回复
    try {
      // 立即显示AI正在思考的状态
      promptStore.isTyping = true

      // 根据用户设置使用流式或非流式模式
      const useStreamMode = isStreamMode.value
      
      if (useStreamMode) {
        // 流式模式
        const aiService = AIService.getInstance()
        
        // 准备流式显示
        let streamingContent = ''
        let messageIndex = -1
        
        // 设置流式回调函数
        aiService.setStreamUpdateCallback((chunk: string) => {
          if (messageIndex === -1) {
            // 第一次收到数据，创建消息
            messageIndex = startStreamingMessage()
          }
          streamingContent += chunk
          // 清理评估标签后显示内容
          const cleanContent = cleanAIResponse(streamingContent)
          updateStreamingMessage(cleanContent)
          scrollToBottom()
        })
        
        // 获取有效消息并调用API
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

        // 清理流式回调
        aiService.clearStreamUpdateCallback()

        // AI智能判断检测
        const shouldEndConversation = checkAIDecision(aiResponse)
        
        if (shouldEndConversation || aiResponse.includes('基于我们的对话，我现在为您生成需求报告：')) {
          setTimeout(async () => {
            await generatePrompt(provider, model.id)
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

        // AI智能判断检测
        const shouldEndConversation = checkAIDecision(aiResponse)
        
        if (shouldEndConversation || aiResponse.includes('基于我们的对话，我现在为您生成需求报告：')) {
          // 清理响应中的评估标签，只显示用户可见内容
          const cleanResponse = cleanAIResponse(aiResponse)
          await simulateTyping(cleanResponse, false)
          
          setTimeout(async () => {
            await generatePrompt(provider, model.id)
          }, 800)
        } else {
          // 正常回复 - 清理评估标签
          const cleanResponse = cleanAIResponse(aiResponse)
          await simulateTyping(cleanResponse, false)
        }
      }
      
      notificationStore.success('消息已重新发送')
      
    } catch (error: unknown) {
      promptStore.isTyping = false
      promptStore.isGenerating = false
      const errorMessage = error instanceof Error ? error.message : String(error)
      notificationStore.error(`重新发送失败: ${errorMessage}`)
      
      // 清理流式回调（如果是流式模式）
      if (isStreamMode.value) {
        const aiService = AIService.getInstance()
        aiService.clearStreamUpdateCallback()
      }
    }
  } else {
    notificationStore.warning('消息内容不能为空')
  }
}

// 重新发送用户消息（新方法，清理后续消息）
const resendUserMessage = async (messageId: string, messageIndex: number) => {
  const message = promptStore.chatMessages.find(msg => msg.id === messageId)
  if (!message || message.type !== 'user') {
    return
  }

  // 检查是否配置了AI模型
  const provider = settingsStore.getCurrentProvider()
  const model = settingsStore.getCurrentModel()
  
  if (!provider || !model) {
    notificationStore.warning('请先在右上角设置中配置AI模型和API密钥')
    return
  }

  try {
    // 删除该用户消息之后的所有消息（包括AI回复）
    if (messageIndex !== -1) {
      // 标记后续消息为删除状态
      for (let i = messageIndex + 1; i < promptStore.chatMessages.length; i++) {
        const msg = promptStore.chatMessages[i]
        if (msg && !msg.isProgress) {
          promptStore.deleteMessage(msg.id!)
        }
      }
    }

    // 重新发送消息，触发AI回复
    // 立即显示AI正在思考的状态
    promptStore.isTyping = true

    // 根据用户设置使用流式或非流式模式
    const useStreamMode = isStreamMode.value
    
    if (useStreamMode) {
      // 流式模式
      const aiService = AIService.getInstance()
      
      // 准备流式显示
      let streamingContent = ''
      let messageIndex = -1
      
      // 设置流式回调函数
      aiService.setStreamUpdateCallback((chunk: string) => {
        if (messageIndex === -1) {
          // 第一次收到数据，创建消息
          messageIndex = startStreamingMessage()
        }
        streamingContent += chunk
        // 清理评估标签后显示内容
        const cleanContent = cleanAIResponse(streamingContent)
        updateStreamingMessage(cleanContent)
        scrollToBottom()
      })
      
      // 获取有效消息并调用API
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

      // 清理流式回调
      aiService.clearStreamUpdateCallback()

      // AI智能判断检测
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基于我们的对话，我现在为您生成需求报告：')) {
        setTimeout(async () => {
          await generatePrompt(provider, model.id)
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

      // AI智能判断检测
      const shouldEndConversation = checkAIDecision(aiResponse)
      
      if (shouldEndConversation || aiResponse.includes('基于我们的对话，我现在为您生成需求报告：')) {
        // 清理响应中的评估标签，只显示用户可见内容
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
        
        setTimeout(async () => {
          await generatePrompt(provider, model.id)
        }, 800)
      } else {
        // 正常回复 - 清理评估标签
        const cleanResponse = cleanAIResponse(aiResponse)
        await simulateTyping(cleanResponse, false)
      }
    }
    
    notificationStore.success('消息已重新发送')
    
  } catch (error: unknown) {
    promptStore.isTyping = false
    promptStore.isGenerating = false
    const errorMessage = error instanceof Error ? error.message : String(error)
    notificationStore.error(`重新发送失败: ${errorMessage}`)
    
    // 清理流式回调（如果是流式模式）
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