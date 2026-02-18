"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import {
  X,
  Plus,
  ArrowLeft,
  Users,
  CreditCard,
  TrendingUp,
  Wallet,
  BarChart3,
  Receipt,
  Copy,
  Check,
  Link2,
  Trash2,
  Tag,
  Bot,
  ChevronRight,
  Layers,
  Loader2,
} from "lucide-react"
import dynamic from "next/dynamic"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  getRefTags,
  getRefTagsSummary,
  getBotStats,
  createRefTag,
  deleteRefTag,
  type TagStats as ApiTagStats,
  type TagItem as ApiTagItem,
  type DailyDataPoint,
} from "@/lib/api"

// -------- Types --------
interface TagStats {
  users: number
  buyers: number
  totalRevenue: number
  dailyData: DailyDataPoint[]
}

interface TagItem {
  name: string
  createdAt: Date
  stats: TagStats
}

type ViewState =
  | { view: "list" }
  | { view: "detail"; tag: TagItem }
  | { view: "my-summary" }
  | { view: "bot-summary" }

// -------- Helpers --------
/** Convert API snake_case TagStats to local camelCase */
function mapStats(api: ApiTagStats): TagStats {
  return {
    users: api.users,
    buyers: api.buyers,
    totalRevenue: api.total_revenue,
    dailyData: api.daily_data,
  }
}

/** Convert API TagItem to local TagItem */
function mapTag(api: ApiTagItem): TagItem {
  return {
    name: api.name,
    createdAt: new Date(api.created_at),
    stats: mapStats(api.stats),
  }
}

const TagStatsChart = dynamic(() => import("./tag-stats-chart"), { ssr: false })

// -------- Component --------
interface TagStatsDrawerProps {
  open: boolean
  onClose: () => void
}

export function TagStatsDrawer({ open, onClose }: TagStatsDrawerProps) {
  const [tags, setTags] = useState<TagItem[]>([])
  const [viewState, setViewState] = useState<ViewState>({ view: "list" })
  const [tagInput, setTagInput] = useState({ value: "", error: "" })
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState<"idle" | "loading" | "creating">("idle")
  const [summaryData, setSummaryData] = useState<{ my: TagStats | null; bot: TagStats | null }>({ my: null, bot: null })

  // ── Fetch ALL data on open (tags + summary + bot stats in parallel) ──
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      setLoadingState("loading")
      try {
        const [tagsData, myData, botData] = await Promise.all([
          getRefTags(),
          getRefTagsSummary(),
          getBotStats(),
        ])
        if (cancelled) return
        if (tagsData) setTags(tagsData.tags.map(mapTag))
        setSummaryData({
          my: myData ? mapStats(myData) : null,
          bot: botData ? mapStats(botData) : null,
        })
        setLoadingState("idle")
      } catch {
        if (!cancelled) setLoadingState("idle")
      }
    }

    load()
    return () => { cancelled = true }
  }, [open])


  const handleCreateTag = useCallback(async () => {
    const name = tagInput.value.trim().toLowerCase()
    if (!name) {
      setTagInput(prev => ({ ...prev, error: "Введите название тега" }))
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setTagInput(prev => ({ ...prev, error: "Только латинские буквы, цифры, _ и -" }))
      return
    }
    if (tags.some((t) => t.name === name)) {
      setTagInput(prev => ({ ...prev, error: "Тег уже существует" }))
      return
    }
    setLoadingState("creating")
    try {
      const result = await createRefTag(name)
      if (result) {
        const data = await getRefTags()
        if (data) {
          setTags(data.tags.map(mapTag))
        }
        setTagInput({ value: "", error: "" })
      }
      setLoadingState("idle")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка создания"
      if (msg === "tag_exists" || msg === "tag_taken") {
        setTagInput(prev => ({ ...prev, error: "Тег уже занят" }))
      } else if (msg === "invalid_characters") {
        setTagInput(prev => ({ ...prev, error: "Недопустимые символы" }))
      } else {
        setTagInput(prev => ({ ...prev, error: msg }))
      }
      setLoadingState("idle")
    }
  }, [tagInput.value, tags])

  const handleDeleteTag = useCallback(
    async (tagName: string) => {
      const ok = await deleteRefTag(tagName)
      if (ok) {
        setTags((prev) => prev.filter((t) => t.name !== tagName))
        if (viewState.view === "detail" && viewState.tag.name === tagName) {
          setViewState({ view: "list" })
        }
      }
    },
    [viewState]
  )

  const handleCopyLink = useCallback((tagName: string) => {
    const link = `https://t.me/VoiceMasterBot?start=${tagName}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(tagName)
      setTimeout(() => setCopiedLink(null), 2000)
    })
  }, [])

  const getLink = (tagName: string) =>
    `https://t.me/VoiceMasterBot?start=${tagName}`

  const handleBack = useCallback(() => {
    setViewState({ view: "list" })
  }, [])

  // ---------- Detail View ----------
  if (viewState.view === "detail") {
    return (
      <TagDetailView
        tag={viewState.tag}
        open={open}
        onClose={onClose}
        onBack={handleBack}
        onDelete={handleDeleteTag}
        onCopyLink={handleCopyLink}
        copiedLink={copiedLink}
        getLink={getLink}
      />
    )
  }

  // ---------- My Summary View ----------
  if (viewState.view === "my-summary" && summaryData.my) {
    return (
      <SummaryView
        title={`Мои теги (${tags.length})`}
        subtitle="Общая статистика по всем вашим тегам"
        stats={summaryData.my}
        icon={<Layers className="w-5 h-5 text-[#c8ff00]" />}
        accentColor="#c8ff00"
        open={open}
        onClose={onClose}
        onBack={handleBack}
      />
    )
  }

  // ---------- Bot Summary View ----------
  if (viewState.view === "bot-summary" && summaryData.bot) {
    return (
      <SummaryView
        title="Статистика бота"
        subtitle="Все пользователи и платежи бота"
        stats={summaryData.bot}
        icon={<Bot className="w-5 h-5 text-[#22d3ee]" />}
        accentColor="#22d3ee"
        open={open}
        onClose={onClose}
        onBack={handleBack}
      />
    )
  }


  // ---------- List View ----------
  return (
    <Drawer
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      repositionInputs={false} // Fix for Android keyboard layout issues
    >
      <DrawerContent className="max-h-[85vh]">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors z-10"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>

        <div className="flex flex-col gap-5 pt-1 overflow-y-auto max-h-[calc(85vh-4rem)]">
          {/* Header */}
          <div>
            <DrawerTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#c8ff00]" />
              Реферальные теги
            </DrawerTitle>
            <DrawerDescription className="mt-1">
              Создавайте теги для отслеживания источников трафика
            </DrawerDescription>
          </div>

          {/* Summary Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Статистика моих тегов */}
            <button
              type="button"
              onClick={() => {
                if (tags.length > 0) {
                  setViewState({ view: "my-summary" })
                }
              }}
              disabled={tags.length === 0}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[#c8ff00]/10 bg-[#c8ff00]/[0.04] hover:bg-[#c8ff00]/[0.07] active:scale-[0.98] transition-[transform,background-color] disabled:opacity-30 disabled:pointer-events-none"
            >
              <div className="w-10 h-10 rounded-xl bg-[#c8ff00]/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-[#c8ff00]" />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-semibold text-white leading-tight">
                  Мои теги
                </p>
                <p className="text-[10px] text-white/35 mt-0.5">
                  {tags.length > 0 ? `${tags.length} ${tags.length === 1 ? "тег" : "тегов"}` : "Нет тегов"}
                </p>
              </div>
            </button>

            {/* Статистика бота */}
            <button
              type="button"
              onClick={() => {
                setViewState({ view: "bot-summary" })
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[#22d3ee]/10 bg-[#22d3ee]/[0.04] hover:bg-[#22d3ee]/[0.07] active:scale-[0.98] transition-[transform,background-color]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#22d3ee]/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-[#22d3ee]" />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-semibold text-white leading-tight">
                  Статистика бота
                </p>
                <p className="text-[10px] text-white/35 mt-0.5">
                  Все пользователи
                </p>
              </div>
            </button>
          </div>

          <Separator className="bg-white/[0.06]" />

          {/* Create Tag Section */}
          <Card className="border-[#c8ff00]/10 bg-[#c8ff00]/[0.03] shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-white/70 mb-2.5">
                Новый тег
              </p>
              <div className="flex gap-2">
                <Input
                  value={tagInput.value}
                  onChange={(e) => {
                    setTagInput({ value: e.target.value, error: "" })
                  }}
                  onBlur={() => {
                    // Fix iOS keyboard layout shift by resetting scroll
                    setTimeout(() => {
                      window.scrollTo(0, 0)
                      document.body.scrollTop = 0
                    }, 100)
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                  placeholder="Например: yt, inst, vk"
                  className="h-10 bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/25 text-sm rounded-xl focus-visible:ring-[#c8ff00]/30"
                />
                <Button
                  onClick={handleCreateTag}
                  disabled={loadingState === "creating"}
                  className="h-10 px-4 rounded-xl bg-[#c8ff00] text-black font-semibold hover:bg-[#d4ff33] active:bg-[#b8ee00] active:scale-[0.97] transition-[transform,background-color] shrink-0"
                >
                  {loadingState === "creating" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      Создать
                    </>
                  )}
                </Button>
              </div>
              {tagInput.error && (
                <p className="text-[11px] text-red-400 mt-1.5">{tagInput.error}</p>
              )}
            </CardContent>
          </Card>

          {/* Tags List */}
          {loadingState === "loading" && tags.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
            </div>
          ) : tags.length > 0 ? (
            <>
              <Separator className="bg-white/[0.06]" />
              <div className="flex flex-col gap-2.5 pb-2">
                <p className="text-xs font-semibold text-white/40 px-0.5">
                  Ваши теги ({tags.length})
                </p>
                {tags.map((tag) => (
                  <TagCard
                    key={tag.name}
                    tag={tag}
                    onSelect={() => {
                      setViewState({ view: "detail", tag })
                    }}
                    onCopyLink={() => handleCopyLink(tag.name)}
                    copiedLink={copiedLink}
                    getLink={getLink}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// -------- Tag Card (List Item) --------
function TagCard({
  tag,
  onSelect,
  onCopyLink,
  copiedLink,
  getLink,
}: {
  tag: TagItem
  onSelect: () => void
  onCopyLink: () => void
  copiedLink: string | null
  getLink: (name: string) => string
}) {
  const conversionRate =
    tag.stats.users > 0
      ? ((tag.stats.buyers / tag.stats.users) * 100).toFixed(1)
      : "0"

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] active:scale-[0.98] transition-[transform,background-color]"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#c8ff00]/10 flex items-center justify-center">
            <Tag className="w-3.5 h-3.5 text-[#c8ff00]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{tag.name}</p>
            <p className="text-[10px] text-white/30 truncate max-w-[180px]">
              {getLink(tag.name)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCopyLink()
          }}
          className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
          aria-label="Копировать ссылку"
        >
          {copiedLink === tag.name ? (
            <Check className="w-3.5 h-3.5 text-[#c8ff00]" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-white/40" />
          )}
        </button>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-white/25" />
          <span className="text-[11px] text-white/50">
            {tag.stats.users}
          </span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1">
          <CreditCard className="w-3 h-3 text-white/25" />
          <span className="text-[11px] text-white/50">
            {tag.stats.buyers}
          </span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-white/25" />
          <span className="text-[11px] text-white/50">{conversionRate}%</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1">
          <Wallet className="w-3 h-3 text-white/25" />
          <span className="text-[11px] text-white/50">
            {tag.stats.totalRevenue.toLocaleString("ru-RU")}&#8381;
          </span>
        </div>
      </div>
    </button>
  )
}

// -------- Summary View (shared for my-tags and global) --------
function SummaryView({
  title,
  subtitle,
  stats,
  icon,
  accentColor,
  open,
  onClose,
  onBack,
}: {
  title: string
  subtitle: string
  stats: TagStats
  icon: React.ReactNode
  accentColor: string
  open: boolean
  onClose: () => void
  onBack: () => void
}) {
  const s = stats
  const conversionRate =
    s.users > 0 ? ((s.buyers / s.users) * 100).toFixed(2) : "0.00"
  const ltv = s.users > 0 ? (s.totalRevenue / s.users).toFixed(2) : "0.00"
  const avgCheck =
    s.buyers > 0 ? (s.totalRevenue / s.buyers).toFixed(2) : "0.00"

  const isAccentGreen = accentColor === "#c8ff00"

  const statCards = useMemo(
    () => [
      {
        label: "Пришло пользователей",
        value: s.users.toLocaleString("ru-RU"),
        icon: Users,
        accent: false,
      },
      {
        label: "Покупателей (карта)",
        value: s.buyers.toLocaleString("ru-RU"),
        icon: CreditCard,
        accent: false,
      },
      {
        label: "Конверсия в покупку",
        value: `${conversionRate}%`,
        icon: TrendingUp,
        accent: true,
      },
      {
        label: "Сумма оплат картой",
        value: `${s.totalRevenue.toLocaleString("ru-RU")}₽`,
        icon: Wallet,
        accent: false,
      },
      {
        label: "LTV на пользователя",
        value: `${ltv}₽`,
        icon: BarChart3,
        accent: false,
      },
      {
        label: "Средний чек",
        value: `${avgCheck}₽`,
        icon: Receipt,
        accent: true,
      },
    ],
    [s.users, s.buyers, s.totalRevenue, conversionRate, ltv, avgCheck]
  )

  const gradientId = isAccentGreen ? "fillUsersSummary" : "fillUsersSummaryBlue"
  const gradientBuyersId = isAccentGreen ? "fillBuyersSummary" : "fillBuyersSummaryBlue"

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        {/* Back & Close */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-medium">Назад</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto max-h-[calc(90vh-6rem)] pb-2">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                {icon}
              </div>
              <div>
                <DrawerTitle className="text-xl">{title}</DrawerTitle>
                <DrawerDescription className="mt-0.5 text-[11px]">
                  {subtitle}
                </DrawerDescription>
              </div>
            </div>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {statCards.map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.label}
                  className="p-3.5 rounded-2xl border transition-colors"
                  style={{
                    backgroundColor: card.accent ? `${accentColor}08` : "rgba(255,255,255,0.03)",
                    borderColor: card.accent ? `${accentColor}18` : "rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
                    style={{
                      backgroundColor: card.accent ? `${accentColor}18` : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: card.accent ? accentColor : "rgba(255,255,255,0.4)" }}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 mb-0.5 leading-relaxed">
                    {card.label}
                  </p>
                  <p className="text-[15px] font-bold text-white">
                    {card.value}
                  </p>
                </div>
              )
            })}
          </div>

          <TagStatsChart
            data={stats.dailyData}
            accentColor={accentColor}
            gradientUsersId={gradientId}
            gradientBuyersId={gradientBuyersId}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// -------- Tag Detail View --------
function TagDetailView({
  tag,
  open,
  onClose,
  onBack,
  onDelete,
  onCopyLink,
  copiedLink,
  getLink,
}: {
  tag: TagItem
  open: boolean
  onClose: () => void
  onBack: () => void
  onDelete: (name: string) => void
  onCopyLink: (name: string) => void
  copiedLink: string | null
  getLink: (name: string) => string
}) {
  const s = tag.stats
  const conversionRate =
    s.users > 0 ? ((s.buyers / s.users) * 100).toFixed(2) : "0.00"
  const ltv = s.users > 0 ? (s.totalRevenue / s.users).toFixed(2) : "0.00"
  const avgCheck =
    s.buyers > 0 ? (s.totalRevenue / s.buyers).toFixed(2) : "0.00"

  const statCards = useMemo(
    () => [
      {
        label: "Пришло пользователей",
        value: s.users.toString(),
        icon: Users,
        accent: false,
      },
      {
        label: "Покупателей (карта)",
        value: s.buyers.toString(),
        icon: CreditCard,
        accent: false,
      },
      {
        label: "Конверсия в покупку",
        value: `${conversionRate}%`,
        icon: TrendingUp,
        accent: true,
      },
      {
        label: "Сумма оплат картой",
        value: `${s.totalRevenue.toLocaleString("ru-RU")}₽`,
        icon: Wallet,
        accent: false,
      },
      {
        label: "LTV на пользователя",
        value: `${ltv}₽`,
        icon: BarChart3,
        accent: false,
      },
      {
        label: "Средний чек",
        value: `${avgCheck}₽`,
        icon: Receipt,
        accent: true,
      },
    ],
    [s.users, s.buyers, s.totalRevenue, conversionRate, ltv, avgCheck]
  )

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        {/* Back & Close */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-medium">Назад</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto max-h-[calc(90vh-6rem)] pb-2">
          {/* Tag Header */}
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#c8ff00]/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-[#c8ff00]" />
              </div>
              <div>
                <DrawerTitle className="text-xl">{tag.name}</DrawerTitle>
                <DrawerDescription className="mt-0.5 text-[11px]">
                  Создан{" "}
                  {tag.createdAt.toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}
                </DrawerDescription>
              </div>
            </div>

            {/* Link row */}
            <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <Link2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
              <span className="text-[11px] text-white/40 truncate flex-1">
                {getLink(tag.name)}
              </span>
              <button
                type="button"
                onClick={() => onCopyLink(tag.name)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 transition-colors shrink-0"
              >
                {copiedLink === tag.name ? (
                  <>
                    <Check className="w-3 h-3 text-[#c8ff00]" />
                    <span className="text-[10px] font-medium text-[#c8ff00]">
                      Скопировано
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-white/40" />
                    <span className="text-[10px] font-medium text-white/50">
                      Копировать
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {statCards.map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.label}
                  className={`p-3.5 rounded-2xl border transition-colors ${card.accent
                    ? "bg-[#c8ff00]/[0.04] border-[#c8ff00]/10"
                    : "bg-white/[0.03] border-white/[0.06]"
                    }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${card.accent ? "bg-[#c8ff00]/10" : "bg-white/[0.06]"
                      }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${card.accent ? "text-[#c8ff00]" : "text-white/40"
                        }`}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 mb-0.5 leading-relaxed">
                    {card.label}
                  </p>
                  <p className="text-[15px] font-bold text-white">
                    {card.value}
                  </p>
                </div>
              )
            })}
          </div>

          <TagStatsChart
            data={tag.stats.dailyData}
            accentColor="#c8ff00"
            gradientUsersId="fillUsers"
            gradientBuyersId="fillBuyers"
          />

          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(tag.name)}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/[0.08] border border-red-500/10 text-red-400 hover:bg-red-500/[0.12] active:scale-[0.98] transition-[transform,background-color]"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Удалить тег</span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
