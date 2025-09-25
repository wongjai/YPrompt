/**
 * AI響應處理工具函數
 */

/**
 * 清理AI響應中的評估標籤和markdown代碼塊標記
 */
export const cleanAIResponse = (response: string): string => {
  try {
    // 移除完整的think標籤及其內容
    let cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    
    // 移除完整的評估標籤及其內容
    cleaned = cleaned.replace(/<ASSESSMENT>[\s\S]*?<\/ASSESSMENT>/gi, '').trim()
    
    // 處理流式過程中不完整的think標籤
    const thinkStart = cleaned.indexOf('<think>')
    if (thinkStart !== -1) {
      cleaned = cleaned.substring(0, thinkStart).trim()
    }
    
    // 處理流式過程中不完整的評估標籤
    // 如果發現開始標籤但沒有結束標籤，截斷到開始標籤之前
    const assessmentStart = cleaned.indexOf('<ASSESSMENT>')
    if (assessmentStart !== -1) {
      cleaned = cleaned.substring(0, assessmentStart).trim()
    }
    
    // 處理其他可能的不完整標籤模式
    const patterns = [
      /<thin[^>]*$/i,     // 不完整的think開始標籤
      /<\/thin[^>]*$/i,   // 不完整的think結束標籤
      /\n\n<thin/i,       // 換行後的think標籤
      /<ASSE[^>]*$/i,     // 不完整的評估開始標籤
      /<\/ASSE[^>]*$/i,   // 不完整的評估結束標籤
      /\n\n<ASSE/i,       // 換行後的評估標籤
      /CONTEXT:/i,        // 評估內容的關鍵詞
      /TASK:/i,
      /FORMAT:/i,
      /QUALITY:/i,
      /TURN_COUNT:/i,
      /DECISION:/i,
      /CONFIDENCE:/i
    ]
    
    for (const pattern of patterns) {
      const match = cleaned.search(pattern)
      if (match !== -1) {
        cleaned = cleaned.substring(0, match).trim()
        break
      }
    }
    
    return cleaned
  } catch (error) {
    return response // 清理失敗時返回原內容
  }
}

/**
 * 清理AI響應中的markdown代碼塊標記和多餘描述（用於格式轉換）
 */
export const cleanAIResponseForFormatting = (response: string): string => {
  return response
    // 移除think標籤（防禦性清理）
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```[\w]*\n?/gm, '')  // 移除開頭的 ```xml 或 ```
    .replace(/\n?```$/gm, '')       // 移除結尾的 ```
    // 移除常見的AI介紹性文字
    .replace(/^Here is the.*?translation.*?:\s*/i, '')
    .replace(/^Here is the.*?converted.*?:\s*/i, '')
    .replace(/^Here is.*?:\s*/i, '')
    .replace(/^以下是.*?翻譯.*?：\s*/i, '')
    .replace(/^以下是.*?轉換.*?：\s*/i, '')
    .replace(/^以下是.*?：\s*/i, '')
    .replace(/^.*?翻譯結果.*?：\s*/i, '')
    .replace(/^.*?轉換結果.*?：\s*/i, '')
    .trim()
}

/**
 * 檢查AI響應中是否包含結束對話的決策
 */
export const checkAIDecision = (response: string): boolean => {
  try {
    // 檢查是否包含評估標籤
    const assessmentMatch = response.match(/<ASSESSMENT>([\s\S]*?)<\/ASSESSMENT>/i)
    if (!assessmentMatch) {
      return false // 沒有評估標籤，繼續對話
    }
    
    const assessmentContent = assessmentMatch[1]
    
    // 提取DECISION字段
    const decisionMatch = assessmentContent.match(/DECISION:\s*\[([^\]]+)\]/i)
    if (decisionMatch) {
      const decision = decisionMatch[1].trim().toUpperCase()
      return decision === 'END_NOW'
    }
    
    return false
  } catch (error) {
    return false // 解析錯誤時繼續對話
  }
}