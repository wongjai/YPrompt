# YPrompt - 智能提示詞生成工具

基於AI對話引導挖掘用戶需求的專業提示詞生成系統，基於《Architecting Intelligence: A Definitive Guide to the Art and Science of Elite Prompt Engineering》理論生成高質量的AI提示詞。

## 一鍵部署

在 Github 上先[![Fork me on GitHub](https://raw.githubusercontent.com/fishforks/fish2018/refs/heads/main/forkme.png)](https://github.com/wongjai/YPrompt/fork)本項目，並點上 Star !!!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/wongjai/YPrompt&build-command=npm%20run%20build&install-command=npm%20install&output-directory=dist)

**Vercel 部署步驟**
1. Fork 本倉庫到您的 GitHub 賬戶
2. 登錄 Vercel，點擊 "New Project"
3. 導入您的倉庫
4. 配置構建參數：
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. 點擊 "Deploy"

## 截圖
**PC端**  
  
![](imgs/pc.gif)

**移動端**  

![](imgs/mobile.gif)

## 核心功能

- **AI引導式需求收集**: 通過智能對話深入挖掘用戶真實需求
- **GPrompt四步生成**: 關鍵指令提取 → 初始提示詞 → 優化建議 → 最終提示詞
- **多AI模型支持**: 支持OpenAI、Anthropic、Google Gemini和自定義AI服務商
- **雙模式操作**: 自動生成和手動步進兩種執行模式
- **格式語言轉換**: 支持Markdown/XML格式切換和中英文互譯
- **響應式設計**: 完美適配桌面端和移動端設備

## 技術棧

- **前端框架**: Vue 3 + TypeScript
- **構建工具**: Vite
- **UI框架**: Tailwind CSS
- **狀態管理**: Pinia
- **圖標庫**: Lucide Vue Next
- **Markdown**: Marked

## 項目結構

```
src/
├── components/          # Vue組件
│   ├── ChatInterface.vue       # 對話界面
│   ├── PreviewPanel.vue        # 預覽面板
│   ├── PromptGenerator.vue     # 提示詞生成器
│   ├── SettingsModal.vue       # 設置彈窗
│   └── NotificationContainer.vue  # 通知容器
├── stores/              # Pinia狀態管理
│   ├── promptStore.ts           # 提示詞狀態
│   ├── settingsStore.ts        # 設置狀態
│   └── notificationStore.ts    # 通知狀態
├── services/            # 業務服務層
│   ├── aiService.ts             # AI服務基礎類
│   ├── aiGuideService.ts        # AI引導服務
│   └── promptGeneratorService.ts # 提示詞生成服務
├── config/              # 配置文件
│   ├── promptGenerator.ts       # 生成器配置
│   └── prompts/                # 內置提示詞規則
├── views/               # 頁面視圖
└── main.ts              # 應用入口
```
