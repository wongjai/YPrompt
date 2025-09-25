/**
 * AI响应处理工具函数
 */

/**
 * 清理AI响应中的评估标签和markdown代码块标记
 */
export const cleanAIResponse = (response: string): string => {
  try {
    // 移除完整的think标签及其内容
    let cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    
    // 移除完整的评估标签及其内容
    cleaned = cleaned.replace(/<ASSESSMENT>[\s\S]*?<\/ASSESSMENT>/gi, '').trim()
    
    // 处理流式过程中不完整的think标签
    const thinkStart = cleaned.indexOf('<think>')
    if (thinkStart !== -1) {
      cleaned = cleaned.substring(0, thinkStart).trim()
    }
    
    // 处理流式过程中不完整的评估标签
    // 如果发现开始标签但没有结束标签，截断到开始标签之前
    const assessmentStart = cleaned.indexOf('<ASSESSMENT>')
    if (assessmentStart !== -1) {
      cleaned = cleaned.substring(0, assessmentStart).trim()
    }
    
    // 处理其他可能的不完整标签模式
    const patterns = [
      /<thin[^>]*$/i,     // 不完整的think开始标签
      /<\/thin[^>]*$/i,   // 不完整的think结束标签
      /\n\n<thin/i,       // 换行后的think标签
      /<ASSE[^>]*$/i,     // 不完整的评估开始标签
      /<\/ASSE[^>]*$/i,   // 不完整的评估结束标签
      /\n\n<ASSE/i,       // 换行后的评估标签
      /CONTEXT:/i,        // 评估内容的关键词
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
    return response // 清理失败时返回原内容
  }
}

/**
 * 清理AI响应中的markdown代码块标记和多余描述（用于格式转换）
 */
export const cleanAIResponseForFormatting = (response: string): string => {
  return response
    // 移除think标签（防御性清理）
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```[\w]*\n?/gm, '')  // 移除开头的 ```xml 或 ```
    .replace(/\n?```$/gm, '')       // 移除结尾的 ```
    // 移除常见的AI介绍性文字
    .replace(/^Here is the.*?translation.*?:\s*/i, '')
    .replace(/^Here is the.*?converted.*?:\s*/i, '')
    .replace(/^Here is.*?:\s*/i, '')
    .replace(/^以下是.*?翻译.*?：\s*/i, '')
    .replace(/^以下是.*?转换.*?：\s*/i, '')
    .replace(/^以下是.*?：\s*/i, '')
    .replace(/^.*?翻译结果.*?：\s*/i, '')
    .replace(/^.*?转换结果.*?：\s*/i, '')
    .trim()
}

/**
 * 检查AI响应中是否包含结束对话的决策
 */
export const checkAIDecision = (response: string): boolean => {
  try {
    // 检查是否包含评估标签
    const assessmentMatch = response.match(/<ASSESSMENT>([\s\S]*?)<\/ASSESSMENT>/i)
    if (!assessmentMatch) {
      return false // 没有评估标签，继续对话
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
    return false // 解析错误时继续对话
  }
}