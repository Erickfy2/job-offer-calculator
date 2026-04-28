// DeepSeek API 服务：房租估算 + 跳槽决策 AI 分析
// API Key 仅存于用户浏览器 localStorage，不经过任何中间服务器

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'
const LS_API_KEY = 'deepseek_api_key'

// ─── Key 的存取 ───────────────────────────────────────────────

export function getStoredApiKey() {
  return localStorage.getItem(LS_API_KEY) || ''
}

export function saveApiKey(apiKey) {
  if (apiKey.trim()) {
    localStorage.setItem(LS_API_KEY, apiKey.trim())
  } else {
    localStorage.removeItem(LS_API_KEY)
  }
}

// ─── 核心调用 ─────────────────────────────────────────────────

/**
 * 调用 DeepSeek API 估算指定地区的月租金
 * @param {string} region - 用户输入的地区描述，如"上海市静安区"
 * @returns {Promise<number>} 估算月租金（元）
 * @throws {Error} message 为 'NO_API_KEY' | 'INVALID_RESPONSE' | 接口错误信息
 */
export async function estimateRentByRegion(region) {
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '你是一个房租估算助手。请根据用户提供的城市和区域，给出该地区普通单身公寓（约20-30平米）的平均月租金预估。注意：你的回复必须只能包含纯数字，不要带有任何货币符号、单位或解释性文字。',
        },
        {
          role: 'user',
          content: `地区：${region}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    const errMsg = errBody?.error?.message || `请求失败（HTTP ${response.status}）`
    throw new Error(errMsg)
  }

  const data = await response.json()
  const rawText = data?.choices?.[0]?.message?.content?.trim() ?? ''

  // 只提取数字字符，去掉所有货币符号/汉字/标点
  const digitsOnly = rawText.replace(/[^\d]/g, '')
  const parsedRent = parseInt(digitsOnly, 10)

  if (!parsedRent || isNaN(parsedRent) || parsedRent <= 0) {
    throw new Error('INVALID_RESPONSE')
  }

  return parsedRent
}

// ─── 跳槽决策 AI 分析（流式输出）──────────────────────────────

/**
 * 调用 DeepSeek API 进行跳槽综合分析，支持流式回调
 * @param {Object} params - 当前/新 Offer 的全量数据与计算结果
 * @param {Function} onChunk - 每收到新内容时的回调，传入当前累积文本
 * @returns {Promise<string>} 完整分析文本
 * @throws {Error} message 为 'NO_API_KEY' | 接口错误信息
 */
export async function analyzeJobOffer(params, onChunk) {
  const apiKey = getStoredApiKey()
  if (!apiKey) throw new Error('NO_API_KEY')

  const {
    currentCityName, offerCityName,
    current, offer,
    currentCalc, offerCalc,
    recoveryAnalysis,
  } = params

  const fmt = (n) => Math.round(n).toLocaleString('zh-CN')
  const pct = (base, target) =>
    base && isFinite(base) && isFinite(target)
      ? (((target - base) / Math.abs(base)) * 100).toFixed(1) + '%'
      : '—'

  const prompt = `
你是一位资深职业规划顾问，精通财务规划与薪资谈判。请根据以下详细数据，生成一份专业、贴近用户实际情况的跳槽决策分析报告。

【当前工作】
城市/地区：${currentCityName}
税前月薪：${fmt(current.monthlySalary)} 元，年薪 ${current.salaryMonths} 个月
五险一金扣除：${(current.socialSecurityRate * 100).toFixed(0)}%
月均房租：${fmt(current.monthlyRent)} 元 | 月均生活交通：${fmt(current.monthlyLiving)} 元
日均工作+通勤：${current.hoursPerDay} 小时，每月工作 ${current.workDaysPerMonth} 天
→ 月度净结余：${fmt(currentCalc.monthlyBalance)} 元 | 年度结余：${fmt(currentCalc.annualBalance)} 元 | 真实时薪：${currentCalc.hourlyRate.toFixed(2)} 元/时

【新 Offer】
城市/地区：${offerCityName}
税前月薪：${fmt(offer.monthlySalary)} 元，年薪 ${offer.salaryMonths} 个月
五险一金扣除：${(offer.socialSecurityRate * 100).toFixed(0)}%
月均房租：${fmt(offer.monthlyRent)} 元 | 月均生活交通：${fmt(offer.monthlyLiving)} 元
日均工作+通勤：${offer.hoursPerDay} 小时，每月工作 ${offer.workDaysPerMonth} 天
一次性迁移成本：${fmt(offer.migrationCost)} 元 | 入职补贴：${fmt(offer.onboardingBonus)} 元
→ 月度净结余：${fmt(offerCalc.monthlyBalance)} 元 | 年度结余：${fmt(offerCalc.annualBalance)} 元 | 真实时薪：${offerCalc.hourlyRate.toFixed(2)} 元/时

【核心对比】
薪资涨幅：${pct(current.monthlySalary, offer.monthlySalary)}
时薪变化：${pct(currentCalc.hourlyRate, offerCalc.hourlyRate)}
月结余变化：${pct(currentCalc.monthlyBalance, offerCalc.monthlyBalance)}
${recoveryAnalysis.isNeverRecover ? '回本周期：永远无法回本（新工作月结余更低）' : recoveryAnalysis.netCost <= 0 ? `迁移成本已被补贴覆盖，净收益 ${fmt(-recoveryAnalysis.netCost)} 元` : `迁移净成本：${fmt(recoveryAnalysis.netCost)} 元，回本周期约 ${recoveryAnalysis.months.toFixed(1)} 个月`}

请按以下结构输出分析报告（语言简洁专业，直接给建议，避免废话）：

**核心结论**
（1-2 句，直接给出结论并说明最核心原因）

**关键风险与亮点**
（列出 3-4 条，⚠️ 标风险，✅ 标亮点）

**如果接受 Offer 的行动建议**
（2-3 条具体可操作建议，如薪资谈判空间、生活成本应对、入职时机等）

**如果暂缓或拒绝的建议**
（1-2 条，说明什么条件下值得重新考虑）
`.trim()

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.6,
      stream: true,
      messages: [
        { role: 'system', content: '你是一位资深职业规划顾问，回复使用中文，语言专业简洁。' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    throw new Error(errBody?.error?.message || `请求失败（HTTP ${response.status}）`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const rawChunk = decoder.decode(value, { stream: true })
    // SSE 格式：每行 "data: {...}" 或 "data: [DONE]"
    for (const line of rawChunk.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const jsonStr = trimmed.slice(6)
      if (jsonStr === '[DONE]') break
      try {
        const parsed = JSON.parse(jsonStr)
        const delta = parsed?.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          fullText += delta
          onChunk(fullText)
        }
      } catch {
        // 忽略解析异常的片段
      }
    }
  }

  return fullText
}
