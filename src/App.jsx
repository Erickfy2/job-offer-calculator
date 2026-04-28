import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Calculator,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Minus,
  ThumbsUp,
  ThumbsDown,
  Scale,
  MapPin,
  Settings,
  KeyRound,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { CITY_REGIONS, CITY_MAP } from './data/cityCostData'
import {
  getStoredApiKey,
  saveApiKey,
  estimateRentByRegion,
  analyzeJobOffer,
} from './services/deepseekRentService'

// ─── 默认数据 ────────────────────────────────────────────────
const DEFAULT_CURRENT = {
  monthlySalary: 15000,
  salaryMonths: 13,
  socialSecurityRate: 0.20,
  monthlyRent: 3000,
  monthlyLiving: 2000,
  workDaysPerMonth: 21.75,
  hoursPerDay: 9,
}

const DEFAULT_OFFER = {
  monthlySalary: 18000,
  salaryMonths: 14,
  socialSecurityRate: 0.20,
  monthlyRent: 4500,
  monthlyLiving: 2500,
  workDaysPerMonth: 21.75,
  hoursPerDay: 10,
  migrationCost: 15000,
  onboardingBonus: 5000,
}

// ─── 计算函数（不改动逻辑）────────────────────────────────────
function calcMonthlyBalance(salary, socialRate, rent, living) {
  const afterSocial = salary * (1 - socialRate)
  const incomeTax = salary * 0.05
  const netSalary = afterSocial - incomeTax
  return netSalary - rent - living
}

function calcAnnualBalance(salary, monthlyBalance, salaryMonths) {
  return monthlyBalance * 12 + salary * (salaryMonths - 12) * 0.8
}

function calcHourlyRate(annualBalance, workDays, hoursPerDay) {
  const totalHours = workDays * hoursPerDay * 12
  if (totalHours <= 0) return 0
  return annualBalance / totalHours
}

// ─── 格式化工具 ──────────────────────────────────────────────
function formatMoney(value) {
  if (!isFinite(value)) return '—'
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function formatRate(value) {
  if (!isFinite(value)) return '—'
  return value.toFixed(2)
}

function calcPercent(base, target) {
  if (!base || !isFinite(base) || !isFinite(target)) return null
  return ((target - base) / Math.abs(base)) * 100
}

// ─── 涨幅徽章组件 ────────────────────────────────────────────
function ChangeBadge({ pct, size = 'sm' }) {
  if (pct === null) return null
  const isUp = pct > 0.05
  const isDown = pct < -0.05
  const textSize = size === 'lg' ? 'text-base' : 'text-xs'
  const px = size === 'lg' ? 'px-3 py-1' : 'px-2 py-0.5'

  if (!isUp && !isDown) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${px} rounded-full bg-gray-100 text-gray-500 font-semibold ${textSize}`}>
        <Minus size={size === 'lg' ? 14 : 10} />
        持平
      </span>
    )
  }
  if (isUp) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${px} rounded-full bg-green-50 text-emerald-700 font-semibold ${textSize}`}>
        <ChevronUp size={size === 'lg' ? 14 : 10} />
        +{pct.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-0.5 ${px} rounded-full bg-red-50 text-red-600 font-semibold ${textSize}`}>
      <ChevronDown size={size === 'lg' ? 14 : 10} />
      {pct.toFixed(1)}%
    </span>
  )
}

// ─── API Key 设置面板 ────────────────────────────────────────
function ApiKeyPanel({ onClose }) {
  const [inputValue, setInputValue] = useState(getStoredApiKey)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    saveApiKey(inputValue)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    setInputValue('')
    saveApiKey('')
  }

  return (
    <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <KeyRound className="text-blue-600" size={16} />
          <h3 className="text-sm font-semibold text-gray-800">DeepSeek API 设置</h3>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">AI 房租估算</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="password"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
        />
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          {saved ? '✓ 已保存' : '保存'}
        </button>
        {inputValue && (
          <button
            onClick={handleClear}
            className="px-3 py-2 text-red-400 hover:text-red-600 border border-red-100 hover:border-red-200 rounded-lg text-sm transition-colors"
          >
            清除
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        🔒 API Key 仅保存在您的浏览器 localStorage 中，本工具不会上传到自有服务器；请勿在公共电脑使用。
      </p>
    </div>
  )
}

// ─── AI 房租估算输入组件 ──────────────────────────────────────
function RentAiInput({ onRentEstimated, onNoApiKey }) {
  const [region, setRegion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successRent, setSuccessRent] = useState(null)

  const handleEstimate = async () => {
    if (!getStoredApiKey()) {
      onNoApiKey()
      return
    }
    if (!region.trim()) return

    setIsLoading(true)
    setErrorMsg('')
    setSuccessRent(null)

    try {
      const rent = await estimateRentByRegion(region.trim())
      setSuccessRent(rent)
      onRentEstimated(rent)
    } catch (err) {
      if (err.message === 'NO_API_KEY') {
        onNoApiKey()
      } else if (err.message === 'INVALID_RESPONSE') {
        setErrorMsg('AI 返回格式异常，请重试或手动输入')
      } else {
        setErrorMsg(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleEstimate()
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
        <Sparkles size={13} className="text-blue-500" />
        AI 估算房租
        <span className="text-xs text-gray-400 font-normal">（输入地区一键获取参考价）</span>
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="如：上海市静安区"
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <button
          onClick={handleEstimate}
          disabled={isLoading || !region.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          {isLoading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              估算中...
            </>
          ) : (
            <>
              <Sparkles size={12} />
              AI 估算
            </>
          )}
        </button>
      </div>
      {errorMsg && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <AlertTriangle size={11} />
          {errorMsg}
        </p>
      )}
      {successRent && !errorMsg && (
        <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
          <CheckCircle size={11} />
          已填入 AI 估算房租 ¥{successRent.toLocaleString()}/月，可手动调整
        </p>
      )}
    </div>
  )
}

// ─── 城市选择器组件（大区分组 + 区级联动）────────────────────
function CitySelector({ selectedCityId, onCityChange }) {
  // 从外部 selectedCityId 推导出当前选中的城市 id（可能是区 id，需反推父城市）
  const deriveCityId = (id) => {
    if (!id) return ''
    const entry = CITY_MAP[id]
    return entry?.parentCityId ?? id
  }

  const [activeCityId, setActiveCityId] = useState(() => deriveCityId(selectedCityId))

  // 当父组件重置 selectedCityId（如点击"示例数据"）时同步清空
  useEffect(() => {
    setActiveCityId(deriveCityId(selectedCityId))
  }, [selectedCityId])

  const activeCityObj = activeCityId ? CITY_MAP[activeCityId] : null
  const hasDistricts = Boolean(activeCityObj?.districts?.length)

  // 当前选中的区 id（selectedCityId 是区级 id 时才有值）
  const currentDistrictId = selectedCityId && CITY_MAP[selectedCityId]?.parentCityId
    ? selectedCityId
    : ''

  const handleCitySelect = (cityId) => {
    setActiveCityId(cityId)
    if (!cityId) {
      onCityChange('')
      return
    }
    const cityObj = CITY_MAP[cityId]
    // 无区级细分：直接填充城市数据
    if (!cityObj?.districts?.length) {
      onCityChange(cityId)
    } else {
      // 有区级细分：等待用户选区，暂不填充
      onCityChange('')
    }
  }

  const handleDistrictSelect = (districtId) => {
    onCityChange(districtId)
  }

  // 确认文案：区级显示 "城市·区"，城市级显示城市名
  const confirmEntry = selectedCityId ? CITY_MAP[selectedCityId] : null
  const confirmName = confirmEntry?.displayName ?? confirmEntry?.name ?? ''

  return (
    <div className="mb-5">
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
        <MapPin size={12} />
        快速填充城市参考数据
      </label>

      {/* 第一级：城市（按大区分组）*/}
      <div className="relative mb-2">
        <select
          value={activeCityId}
          onChange={(e) => handleCitySelect(e.target.value)}
          className="w-full px-3 py-2.5 pr-8 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer"
        >
          <option value="">— 选择城市 —</option>
          {CITY_REGIONS.map((region) => (
            <optgroup key={region.regionName} label={`── ${region.regionName}地区 ──`}>
              {region.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.districts
                    ? `${city.name}（可细分到区）`
                    : `${city.name}（租金 ¥${city.monthlyRent.toLocaleString()}/月）`}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          size={14}
        />
      </div>

      {/* 第二级：区（仅当城市有区级数据时显示）*/}
      {hasDistricts && (
        <div className="relative">
          <select
            value={currentDistrictId}
            onChange={(e) => handleDistrictSelect(e.target.value)}
            className="w-full px-3 py-2.5 pr-8 border border-blue-200 rounded-lg text-sm text-gray-700 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer"
          >
            <option value="">— 选择区域（可选）—</option>
            {activeCityObj.districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}（租金 ¥{district.monthlyRent.toLocaleString()}/月）
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none"
            size={14}
          />
        </div>
      )}

      {confirmName && (
        <p className="mt-1.5 text-xs text-blue-500">
          已填入 {confirmName} 参考数据，可继续手动调整
        </p>
      )}
    </div>
  )
}

// ─── 输入框组件 ──────────────────────────────────────────────
function InputField({ label, value, onChange, unit, min, max, step, hint }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step || 1}
          className="w-full px-3 py-2.5 pr-12 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── 结果对比卡片（升级版）────────────────────────────────────
function ResultCard({ label, currentValue, offerValue, formatFn, isHigherBetter = true, prefix = '¥' }) {
  const diff = offerValue - currentValue
  const isPositive = isHigherBetter ? diff > 0 : diff < 0
  const isNeutral = Math.abs(diff) < 0.01
  const pct = calcPercent(currentValue, offerValue)

  const cardBg = isNeutral
    ? 'bg-white'
    : isPositive
    ? 'bg-green-50 border-green-100'
    : 'bg-red-50 border-red-100'

  return (
    <div className={`rounded-xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        <ChangeBadge pct={isHigherBetter ? pct : pct !== null ? -pct : null} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-1">当前</p>
          <p className="text-xl font-bold text-gray-700">
            {prefix}{formatFn(currentValue)}
          </p>
        </div>
        <ArrowRight className="text-gray-300 flex-shrink-0" size={18} />
        <div className="flex-1 text-right">
          <p className="text-xs text-gray-400 mb-1">新 Offer</p>
          <p className={`text-xl font-bold ${isNeutral ? 'text-gray-700' : isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {prefix}{formatFn(offerValue)}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">差额</span>
        <span className={`text-sm font-semibold ${isNeutral ? 'text-gray-500' : isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
          {isNeutral ? '持平' : (diff > 0 ? '+' : '')}{prefix}{formatMoney(diff)}
        </span>
      </div>
    </div>
  )
}

// ─── 涨幅速览条 ──────────────────────────────────────────────
function GrowthOverview({ salaryPct, balancePct, hourlyPct }) {
  const items = [
    { label: '薪资涨幅', pct: salaryPct, icon: <TrendingUp size={14} /> },
    { label: '月度结余变化', pct: balancePct, icon: <ChevronUp size={14} /> },
    { label: '真实时薪变化', pct: hourlyPct, icon: <Clock size={14} /> },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">三项核心涨幅速览</p>
      <div className="grid grid-cols-3 gap-4">
        {items.map(({ label, pct, icon }) => {
          const isUp = pct !== null && pct > 0.05
          const isDown = pct !== null && pct < -0.05
          return (
            <div key={label} className="text-center">
              <p className="text-xs text-gray-400 mb-1.5 flex items-center justify-center gap-1">
                <span className={isUp ? 'text-emerald-500' : isDown ? 'text-red-400' : 'text-gray-400'}>{icon}</span>
                {label}
              </p>
              <ChangeBadge pct={pct} size="lg" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 决策建议卡片 ────────────────────────────────────────────
function DecisionCard({ currentCalc, offerCalc, currentData, offerData, recoveryAnalysis, conclusion }) {
  const reasons = []

  const rentPct = calcPercent(currentData.monthlyRent, offerData.monthlyRent)
  const salaryPct = calcPercent(currentData.monthlySalary, offerData.monthlySalary)
  const hourlyPct = calcPercent(currentCalc.hourlyRate, offerCalc.hourlyRate)
  const balancePct = calcPercent(currentCalc.monthlyBalance, offerCalc.monthlyBalance)

  // 时薪维度：最核心的劳动价值判断
  if (conclusion.hourlyDown) {
    const dropAbs = Math.abs(hourlyPct ?? 0).toFixed(1)
    reasons.push({
      type: 'bad',
      label: '劳动回报在悄悄缩水',
      text: `表面上薪资涨了，但每小时的付出换到手的钱却少了 ${dropAbs}%。更高的工时消耗掉了涨薪的实质，这种"涨薪"值得警惕。`,
    })
  } else if (hourlyPct !== null && hourlyPct > 0) {
    reasons.push({
      type: 'good',
      label: '每一小时都更值钱了',
      text: `真实时薪提升了 +${hourlyPct.toFixed(1)}%，这意味着你不只是赚得更多，而是单位时间内创造了更多价值。这才是跳槽真正值得的地方。`,
    })
  }

  // 回本周期维度
  if (recoveryAnalysis.isNeverRecover) {
    const monthlyLoss = formatMoney(currentCalc.monthlyBalance - offerCalc.monthlyBalance)
    reasons.push({
      type: 'bad',
      label: '每个月都在倒贴',
      text: `跳过去之后，每月到手的结余反而少了 ¥${monthlyLoss}。搬家的钱不仅回不来，还要月月亏损——这笔账怎么算都不划算。`,
    })
  } else if (recoveryAnalysis.netCost > 0 && recoveryAnalysis.months > 6) {
    const monthsText = recoveryAnalysis.months.toFixed(1)
    const yearsHint = recoveryAnalysis.months >= 12 ? `，相当于超过 ${Math.floor(recoveryAnalysis.months / 12)} 年` : ''
    reasons.push({
      type: 'warn',
      label: '回本路有点长，需要一点耐心',
      text: `把搬家、违约金这些成本摊开来算，要 ${monthsText} 个月才能回本${yearsHint}。在这之前，收益都在"还债"。建议先摸清公司的稳定性，再做决定。`,
    })
  } else if (recoveryAnalysis.netCost > 0 && recoveryAnalysis.months <= 6) {
    reasons.push({
      type: 'good',
      label: '迁移成本在可控范围内',
      text: `跳槽的一次性成本只需 ${recoveryAnalysis.months.toFixed(1)} 个月就能回本，风险可控。后续每月都是净赚，不用太担心。`,
    })
  } else if (recoveryAnalysis.netCost <= 0) {
    reasons.push({
      type: 'good',
      label: '入职补贴直接帮你赚了一笔',
      text: `签字费/安家费不仅覆盖了所有迁移成本，还净赚了 ¥${formatMoney(-recoveryAnalysis.netCost)}。等于还没入职，就已经赢了。`,
    })
  }

  // 房租 / 月结余维度
  if (rentPct !== null && rentPct > 30) {
    reasons.push({
      type: 'warn',
      label: '房东会分走你不少涨薪',
      text: `新城市的房租比现在贵了 ${rentPct.toFixed(0)}%，是生活成本里最大的变量。薪资涨了，但每个月打开租房 App 可能会有一种"到嘴的肉又吐出去了"的感觉。`,
    })
  } else if (balancePct !== null && balancePct > 10) {
    reasons.push({
      type: 'good',
      label: '钱包每个月都能更充实',
      text: `扣掉所有生活成本之后，月度结余还能多出 +${balancePct.toFixed(1)}%，相当于每月多存 ¥${formatMoney(offerCalc.monthlyBalance - currentCalc.monthlyBalance)}。积累下来，差距会很明显。`,
    })
  }

  // 薪资涨幅维度（补充项）
  if (salaryPct !== null && salaryPct > 20 && !conclusion.hourlyDown) {
    reasons.push({
      type: 'good',
      label: '薪资涨幅相当有竞争力',
      text: `+${salaryPct.toFixed(1)}% 的涨幅已经超过大多数跳槽的平均水平，说明新公司对你的定价是真诚的。`,
    })
  }

  const topReasons = reasons.slice(0, 3)

  const badCount = topReasons.filter((r) => r.type === 'bad').length

  let verdict, verdictColor, verdictBg, VerdictIcon, summaryText
  if (recoveryAnalysis.isNeverRecover || (conclusion.hourlyDown && badCount >= 2)) {
    verdict = '不建议跳槽'
    verdictColor = 'text-red-700'
    verdictBg = 'bg-red-50 border-red-200'
    VerdictIcon = <ThumbsDown className="text-red-500" size={26} />
    summaryText = '从数字来看，这次跳槽很可能是"看起来涨薪，实际上吃亏"。建议重新谈谈条件，或者再等等更合适的机会。'
  } else if (conclusion.isGoodDeal) {
    verdict = '建议跳槽'
    verdictColor = 'text-emerald-700'
    verdictBg = 'bg-green-50 border-green-200'
    VerdictIcon = <ThumbsUp className="text-emerald-600" size={26} />
    summaryText = '无论从时薪还是回本速度来看，这都是一份真实提升生活质量的 Offer，值得认真考虑。'
  } else {
    verdict = '谨慎考虑'
    verdictColor = 'text-amber-700'
    verdictBg = 'bg-amber-50 border-amber-200'
    VerdictIcon = <Scale className="text-amber-500" size={26} />
    summaryText = '好消息和顾虑都有，跳还是不跳，数字只是参考。最终还是要结合你对这家公司的判断、职业方向和个人状态来决定。'
  }

  const reasonStyleMap = {
    good: {
      border: 'border-emerald-100',
      bg: 'bg-white',
      labelColor: 'text-emerald-700',
      textColor: 'text-gray-600',
      icon: <CheckCircle className="text-emerald-500 flex-shrink-0" size={15} />,
      dot: 'bg-emerald-400',
    },
    warn: {
      border: 'border-amber-100',
      bg: 'bg-white',
      labelColor: 'text-amber-700',
      textColor: 'text-gray-600',
      icon: <AlertTriangle className="text-amber-400 flex-shrink-0" size={15} />,
      dot: 'bg-amber-400',
    },
    bad: {
      border: 'border-red-100',
      bg: 'bg-white',
      labelColor: 'text-red-600',
      textColor: 'text-gray-600',
      icon: <AlertTriangle className="text-red-400 flex-shrink-0" size={15} />,
      dot: 'bg-red-400',
    },
  }

  return (
    <div className={`rounded-2xl border-2 p-6 shadow-sm ${verdictBg}`}>
      {/* 标题行 */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">综合决策建议</p>
      <div className="flex items-center gap-3 mb-2">
        {VerdictIcon}
        <h2 className={`text-3xl font-extrabold tracking-tight ${verdictColor}`}>{verdict}</h2>
      </div>
      {/* 人性化总结语 */}
      <p className="text-sm text-gray-500 leading-relaxed mb-5 pl-1">{summaryText}</p>

      {/* 分隔线 */}
      <div className="border-t border-gray-100 mb-4" />

      {/* 原因卡片列表 */}
      <div className="space-y-3">
        {topReasons.map((reason, idx) => {
          const style = reasonStyleMap[reason.type]
          return (
            <div key={idx} className={`rounded-xl border ${style.border} ${style.bg} px-4 py-3`}>
              <div className="flex items-center gap-2 mb-1">
                {style.icon}
                <p className={`text-xs font-bold ${style.labelColor}`}>{reason.label}</p>
              </div>
              <p className={`text-sm leading-relaxed ${style.textColor} pl-5`}>{reason.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Markdown 轻量渲染（仅处理 **bold** 和换行）────────────────
function MarkdownText({ text }) {
  return (
    <div className="space-y-0.5">
      {text.split('\n').map((line, lineIdx) => {
        if (!line.trim()) return <div key={lineIdx} className="h-2" />

        // 纯标题行：整行被 ** 包裹
        if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
          return (
            <p key={lineIdx} className="font-bold text-gray-800 text-sm mt-4 mb-1">
              {line.replace(/\*\*/g, '')}
            </p>
          )
        }

        // 行内 **bold** 混合普通文字
        const segments = line.split(/(\*\*[^*]+\*\*)/g)
        return (
          <p key={lineIdx} className="text-sm text-gray-700 leading-relaxed">
            {segments.map((seg, segIdx) =>
              /^\*\*[^*]+\*\*$/.test(seg)
                ? <strong key={segIdx}>{seg.replace(/\*\*/g, '')}</strong>
                : seg
            )}
          </p>
        )
      })}
    </div>
  )
}

// ─── AI 决策分析组件 ──────────────────────────────────────────
function AiDecisionAnalysis({
  current, offer, currentCalc, offerCalc,
  recoveryAnalysis, currentCityId, offerCityId,
  offerProspectNote,
  onNoApiKey,
}) {
  const [streamingText, setStreamingText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [hasAnalyzed, setHasAnalyzed] = useState(false)

  const getCityName = (cityId) => {
    if (!cityId) return '未指定'
    const entry = CITY_MAP[cityId]
    return entry?.displayName ?? entry?.name ?? '未指定'
  }

  const handleAnalyze = async () => {
    if (!getStoredApiKey()) {
      onNoApiKey()
      return
    }
    setIsLoading(true)
    setErrorMsg('')
    setStreamingText('')
    setHasAnalyzed(false)

    try {
      await analyzeJobOffer(
        {
          currentCityName: getCityName(currentCityId),
          offerCityName: getCityName(offerCityId),
          current,
          offer,
          currentCalc,
          offerCalc,
          recoveryAnalysis,
          offerProspectNote,
        },
        (partialText) => setStreamingText(partialText),
      )
      setHasAnalyzed(true)
    } catch (err) {
      if (err.message === 'NO_API_KEY') {
        onNoApiKey()
      } else {
        setErrorMsg(err.message || 'AI 分析失败，请重试')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 shadow-sm p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 rounded-lg p-1.5">
            <Sparkles className="text-white" size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">AI 深度决策分析</h3>
            <p className="text-xs text-gray-400">基于您的真实数据，给出个性化建议</p>
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
        >
          {isLoading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <Sparkles size={13} />
              {hasAnalyzed ? '重新分析' : '开始分析'}
            </>
          )}
        </button>
      </div>

      {/* 错误提示 */}
      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="text-red-400 flex-shrink-0" size={14} />
          <p className="text-xs text-red-500">{errorMsg}</p>
        </div>
      )}

      {/* 流式输出内容 */}
      {(streamingText || isLoading) && !errorMsg && (
        <div className="bg-white rounded-xl border border-blue-100 p-5">
          {streamingText
            ? <MarkdownText text={streamingText} />
            : (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin text-blue-400" />
                AI 正在分析您的数据...
              </div>
            )
          }
          {/* 流式光标 */}
          {isLoading && streamingText && (
            <span className="inline-block w-0.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      )}

      {/* 未开始时的引导提示 */}
      {!streamingText && !isLoading && !errorMsg && (
        <div className="text-center py-6 text-gray-400">
          <Sparkles size={28} className="mx-auto mb-2 text-blue-200" />
          <p className="text-xs">点击"开始分析"，AI 将根据您填写的数据</p>
          <p className="text-xs">给出专业的跳槽决策建议</p>
        </div>
      )}
    </div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────
export default function App() {
  const [current, setCurrent] = useState(DEFAULT_CURRENT)
  const [offer, setOffer] = useState(DEFAULT_OFFER)
  const [currentCityId, setCurrentCityId] = useState('')
  const [offerCityId, setOfferCityId] = useState('')
  const [offerProspectNote, setOfferProspectNote] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef(null)

  const updateCurrent = (key) => (val) => setCurrent((prev) => ({ ...prev, [key]: val }))
  const updateOffer = (key) => (val) => setOffer((prev) => ({ ...prev, [key]: val }))

  // 无 API Key 时，展开设置面板并滚动到顶部
  const handleNoApiKey = () => {
    setShowSettings(true)
    setTimeout(() => {
      settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // 选择城市后自动填充生活成本字段
  const handleCurrentCityChange = (cityId) => {
    setCurrentCityId(cityId)
    if (!cityId) return
    const city = CITY_MAP[cityId]
    if (!city) return
    setCurrent((prev) => ({
      ...prev,
      monthlyRent: city.monthlyRent,
      monthlyLiving: city.monthlyLiving,
      workDaysPerMonth: city.workDaysPerMonth,
      hoursPerDay: city.hoursPerDay,
    }))
  }

  const handleOfferCityChange = (cityId) => {
    setOfferCityId(cityId)
    if (!cityId) return
    const city = CITY_MAP[cityId]
    if (!city) return
    setOffer((prev) => ({
      ...prev,
      monthlyRent: city.monthlyRent,
      monthlyLiving: city.monthlyLiving,
      workDaysPerMonth: city.workDaysPerMonth,
      hoursPerDay: city.hoursPerDay,
    }))
  }

  const resetToDefaults = () => {
    setCurrent(DEFAULT_CURRENT)
    setOffer(DEFAULT_OFFER)
    setCurrentCityId('')
    setOfferCityId('')
    setOfferProspectNote('')
  }

  const hasApiKey = Boolean(getStoredApiKey())

  // ── 实时计算（逻辑不变）
  const currentCalc = useMemo(() => {
    const monthlyBalance = calcMonthlyBalance(
      current.monthlySalary,
      current.socialSecurityRate,
      current.monthlyRent,
      current.monthlyLiving
    )
    const annualBalance = calcAnnualBalance(current.monthlySalary, monthlyBalance, current.salaryMonths)
    const hourlyRate = calcHourlyRate(annualBalance, current.workDaysPerMonth, current.hoursPerDay)
    return { monthlyBalance, annualBalance, hourlyRate }
  }, [current])

  const offerCalc = useMemo(() => {
    const monthlyBalance = calcMonthlyBalance(
      offer.monthlySalary,
      offer.socialSecurityRate,
      offer.monthlyRent,
      offer.monthlyLiving
    )
    const annualBalance = calcAnnualBalance(offer.monthlySalary, monthlyBalance, offer.salaryMonths)
    const hourlyRate = calcHourlyRate(annualBalance, offer.workDaysPerMonth, offer.hoursPerDay)
    return { monthlyBalance, annualBalance, hourlyRate }
  }, [offer])

  // ── 回本周期（逻辑不变）
  const recoveryAnalysis = useMemo(() => {
    const netMigrationCost = offer.migrationCost - offer.onboardingBonus
    const balanceDiff = offerCalc.monthlyBalance - currentCalc.monthlyBalance
    if (balanceDiff <= 0) return { months: Infinity, isNeverRecover: true, netCost: netMigrationCost }
    if (netMigrationCost <= 0) return { months: 0, isNeverRecover: false, netCost: netMigrationCost }
    return { months: netMigrationCost / balanceDiff, isNeverRecover: false, netCost: netMigrationCost }
  }, [offer.migrationCost, offer.onboardingBonus, offerCalc.monthlyBalance, currentCalc.monthlyBalance])

  // ── 结论逻辑（不变）
  const conclusion = useMemo(() => {
    const hourlyDown = offerCalc.hourlyRate < currentCalc.hourlyRate
    const isSlowRecovery = recoveryAnalysis.months > 6
    const isGoodDeal = !hourlyDown && !isSlowRecovery && recoveryAnalysis.netCost >= 0
    return { hourlyDown, isSlowRecovery, isGoodDeal }
  }, [offerCalc.hourlyRate, currentCalc.hourlyRate, recoveryAnalysis])

  // ── 涨幅计算
  const salaryPct = calcPercent(current.monthlySalary, offer.monthlySalary)
  const balancePct = calcPercent(currentCalc.monthlyBalance, offerCalc.monthlyBalance)
  const hourlyPct = calcPercent(currentCalc.hourlyRate, offerCalc.hourlyRate)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部标题栏 */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-blue-600 rounded-xl p-2.5 flex-shrink-0">
                <Calculator className="text-white" size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">跳槽真实收益计算器</h1>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  帮助你判断跳槽后真实收入，而不是表面涨薪
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw size={13} />
                示例数据
              </button>
              <button
                onClick={() => setShowSettings((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  showSettings
                    ? 'bg-blue-600 text-white'
                    : hasApiKey
                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Settings size={13} />
                {hasApiKey ? 'API 已配置' : '配置 API Key'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── API Key 设置面板 ── */}
        <div ref={settingsRef}>
          {showSettings && (
            <ApiKeyPanel onClose={() => setShowSettings(false)} />
          )}
        </div>

        {/* ── 双栏输入区 ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 左栏：当前工作 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="bg-gray-100 rounded-lg p-1.5">
                <Briefcase className="text-gray-600" size={18} />
              </div>
              <h2 className="text-base font-semibold text-gray-800">当前工作</h2>
            </div>
            <CitySelector selectedCityId={currentCityId} onCityChange={handleCurrentCityChange} />
            <div className="border-b border-gray-100 pb-4 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">薪资与工时</p>
              <InputField label="税前月薪" value={current.monthlySalary} onChange={updateCurrent('monthlySalary')} unit="元" min={0} />
              <InputField label="每年发薪月数" value={current.salaryMonths} onChange={updateCurrent('salaryMonths')} unit="月" min={12} max={18} step={0.5} hint="含年终奖" />
              <InputField label="五险一金扣除比例" value={current.socialSecurityRate} onChange={updateCurrent('socialSecurityRate')} unit="小数" min={0} max={0.5} step={0.01} hint="如 0.20" />
              <InputField label="每月工作天数" value={current.workDaysPerMonth} onChange={updateCurrent('workDaysPerMonth')} unit="天" min={1} max={31} step={0.25} hint="双休约 21.75" />
              <InputField label="日均工作及通勤时长" value={current.hoursPerDay} onChange={updateCurrent('hoursPerDay')} unit="小时" min={1} max={24} step={0.5} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">月度生活成本</p>
              <RentAiInput
                onRentEstimated={updateCurrent('monthlyRent')}
                onNoApiKey={handleNoApiKey}
              />
              <InputField label="每月房租" value={current.monthlyRent} onChange={updateCurrent('monthlyRent')} unit="元" min={0} />
              <InputField label="每月生活交通费" value={current.monthlyLiving} onChange={updateCurrent('monthlyLiving')} unit="元" min={0} hint="餐饮+交通+杂费" />
            </div>
          </div>

          {/* 右栏：新 Offer */}
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 ring-1 ring-blue-50">
            <div className="flex items-center gap-2 mb-5">
              <div className="bg-blue-50 rounded-lg p-1.5">
                <TrendingUp className="text-blue-600" size={18} />
              </div>
              <h2 className="text-base font-semibold text-blue-700">新 Offer</h2>
            </div>
            <CitySelector selectedCityId={offerCityId} onCityChange={handleOfferCityChange} />
            <div className="border-b border-gray-100 pb-4 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">薪资与工时</p>
              <InputField label="税前月薪" value={offer.monthlySalary} onChange={updateOffer('monthlySalary')} unit="元" min={0} />
              <InputField label="每年发薪月数" value={offer.salaryMonths} onChange={updateOffer('salaryMonths')} unit="月" min={12} max={18} step={0.5} hint="含年终奖" />
              <InputField label="五险一金扣除比例" value={offer.socialSecurityRate} onChange={updateOffer('socialSecurityRate')} unit="小数" min={0} max={0.5} step={0.01} hint="如 0.20" />
              <InputField label="每月工作天数" value={offer.workDaysPerMonth} onChange={updateOffer('workDaysPerMonth')} unit="天" min={1} max={31} step={0.25} hint="双休约 21.75" />
              <InputField label="日均工作及通勤时长" value={offer.hoursPerDay} onChange={updateOffer('hoursPerDay')} unit="小时" min={1} max={24} step={0.5} />
            </div>
            <div className="border-b border-gray-100 pb-4 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">月度生活成本</p>
              <RentAiInput
                onRentEstimated={updateOffer('monthlyRent')}
                onNoApiKey={handleNoApiKey}
              />
              <InputField label="每月房租" value={offer.monthlyRent} onChange={updateOffer('monthlyRent')} unit="元" min={0} />
              <InputField label="每月生活交通费" value={offer.monthlyLiving} onChange={updateOffer('monthlyLiving')} unit="元" min={0} hint="餐饮+交通+杂费" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-xs">仅新 Offer</span>
                {' '}跳槽特殊费用
              </p>
              <InputField label="一次性迁移成本" value={offer.migrationCost} onChange={updateOffer('migrationCost')} unit="元" min={0} hint="搬家/违约金/中介等" />
              <InputField label="一次性入职补贴" value={offer.onboardingBonus} onChange={updateOffer('onboardingBonus')} unit="元" min={0} hint="签字费/安家费等" />
            </div>
            <div className="pt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                <span className="bg-violet-50 text-violet-500 px-1.5 py-0.5 rounded text-xs">主观评估</span>
                {' '}岗位上升空间
                <span className="text-gray-300 font-normal normal-case ml-1">（选填）</span>
              </p>
              <textarea
                value={offerProspectNote}
                onChange={(e) => setOfferProspectNote(e.target.value)}
                rows={4}
                placeholder="例如：与 HR / 业务主管聊完，感觉该岗位负责核心项目，团队氛围不错，且未来 1-2 年有明确的晋升空间..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all resize-none leading-relaxed"
              />
              <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
                AI 将结合此段主观描述与薪资数据，综合判断是否值得接受 Offer。
              </p>
            </div>
          </div>
        </div>

        {/* ── 涨幅速览条 ── */}
        <GrowthOverview salaryPct={salaryPct} balancePct={balancePct} hourlyPct={hourlyPct} />

        {/* ── 收益对比卡片 ── */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">收益对比分析</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ResultCard
              label="月度结余"
              currentValue={currentCalc.monthlyBalance}
              offerValue={offerCalc.monthlyBalance}
              formatFn={formatMoney}
            />
            <ResultCard
              label="年度总结余"
              currentValue={currentCalc.annualBalance}
              offerValue={offerCalc.annualBalance}
              formatFn={formatMoney}
            />
            <ResultCard
              label="真实时薪"
              currentValue={currentCalc.hourlyRate}
              offerValue={offerCalc.hourlyRate}
              formatFn={formatRate}
              prefix="¥"
            />
          </div>
        </div>

        {/* ── 回本周期 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="text-gray-500" size={16} />
            <h3 className="text-sm font-semibold text-gray-700">迁移成本回本周期</h3>
          </div>
          {recoveryAnalysis.netCost <= 0 ? (
            <p className="text-sm text-emerald-600 font-medium">
              入职补贴已完全覆盖迁移成本，无需回本周期。净收益：¥{formatMoney(-recoveryAnalysis.netCost)}
            </p>
          ) : recoveryAnalysis.isNeverRecover ? (
            <p className="text-sm text-red-500 font-medium">
              ⚠️ 新工作月度结余低于当前，永远无法回本。实属倒贴打工。
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <p className="text-2xl font-bold text-gray-800">
                  {recoveryAnalysis.months.toFixed(1)}
                  <span className="text-sm font-normal text-gray-500 ml-1">个月</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  净成本 ¥{formatMoney(recoveryAnalysis.netCost)} ÷ 月差 ¥{formatMoney(offerCalc.monthlyBalance - currentCalc.monthlyBalance)}
                </p>
              </div>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${recoveryAnalysis.months <= 3 ? 'bg-emerald-400' : recoveryAnalysis.months <= 6 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min((recoveryAnalysis.months / 12) * 100, 100)}%` }}
                />
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${recoveryAnalysis.months <= 3 ? 'bg-green-50 text-emerald-700' : recoveryAnalysis.months <= 6 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                {recoveryAnalysis.months <= 3 ? '极快' : recoveryAnalysis.months <= 6 ? '合理' : '偏慢'}
              </span>
            </div>
          )}
        </div>

        {/* ── 智能诊断 ── */}
        <div className="space-y-3 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">智能诊断</p>

          {conclusion.hourlyDown && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-semibold text-red-700">⚠️ 警惕虚假涨薪！</p>
                <p className="text-sm text-red-600 mt-0.5">
                  虽然月薪更高，但真实时薪从 ¥{formatRate(currentCalc.hourlyRate)}/小时 下降到 ¥{formatRate(offerCalc.hourlyRate)}/小时（降幅 {Math.abs(hourlyPct ?? 0).toFixed(1)}%），说明你用更多时间换来的是表面涨薪，实际劳动价值下降了。
                </p>
              </div>
            </div>
          )}

          {!recoveryAnalysis.isNeverRecover && recoveryAnalysis.months > 6 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-semibold text-amber-700">⚠️ 迁移成本较高</p>
                <p className="text-sm text-amber-600 mt-0.5">
                  需要 {recoveryAnalysis.months.toFixed(1)} 个月才能回本，期间收益全部用于偿还跳槽成本。建议评估公司稳定性后再决策。
                </p>
              </div>
            </div>
          )}

          {recoveryAnalysis.isNeverRecover && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-semibold text-red-700">⚠️ 月度结余倒退</p>
                <p className="text-sm text-red-600 mt-0.5">
                  跳槽后每月结余反而减少 ¥{formatMoney(currentCalc.monthlyBalance - offerCalc.monthlyBalance)}，迁移成本永远无法通过结余差额回收，实属倒贴打工。
                </p>
              </div>
            </div>
          )}

          {conclusion.isGoodDeal && (
            <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl p-4">
              <CheckCircle className="text-emerald-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-semibold text-emerald-700">✅ 恭喜！这是一份真正提升生活质量的 Offer</p>
                <p className="text-sm text-emerald-600 mt-0.5">
                  时薪从 ¥{formatRate(currentCalc.hourlyRate)}/小时 提升到 ¥{formatRate(offerCalc.hourlyRate)}/小时（+{(hourlyPct ?? 0).toFixed(1)}%），
                  {recoveryAnalysis.months > 0
                    ? `且仅需 ${recoveryAnalysis.months.toFixed(1)} 个月即可回本。薪资增长和生活质量双双提升，值得考虑。`
                    : '且入职补贴完全覆盖迁移成本，可以放心跳槽。'}
                </p>
              </div>
            </div>
          )}

          {!conclusion.hourlyDown && !conclusion.isGoodDeal && !recoveryAnalysis.isNeverRecover && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <Scale className="text-blue-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-semibold text-blue-700">综合评估</p>
                <p className="text-sm text-blue-600 mt-0.5">
                  时薪提升且迁移成本在合理范围内，但回本周期稍长（{recoveryAnalysis.months.toFixed(1)} 个月）。建议结合职业发展前景综合决策。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── 决策建议卡片（最终结论）── */}
        <DecisionCard
          currentCalc={currentCalc}
          offerCalc={offerCalc}
          currentData={current}
          offerData={offer}
          recoveryAnalysis={recoveryAnalysis}
          conclusion={conclusion}
        />

        {/* ── AI 深度决策分析 ── */}
        <AiDecisionAnalysis
          current={current}
          offer={offer}
          currentCalc={currentCalc}
          offerCalc={offerCalc}
          recoveryAnalysis={recoveryAnalysis}
          currentCityId={currentCityId}
          offerCityId={offerCityId}
          offerProspectNote={offerProspectNote}
          onNoApiKey={handleNoApiKey}
        />

        <div className="mt-8 pb-6 space-y-1 text-center">
          <p className="text-xs text-gray-400">
            本计算器采用简易个税估算（月薪×5%），结果仅供参考，不作为财务决策依据
          </p>
          <p className="text-xs text-gray-400">
            城市数据为示例参考数据，实际生活成本以个人情况为准
          </p>
        </div>
      </main>
    </div>
  )
}
