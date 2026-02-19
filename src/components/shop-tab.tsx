"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { Sparkles, Zap, Crown, Gem, BarChart3, ChevronRight, Timer, ShieldCheck, HelpCircle, CreditCard, ChevronDown, Clock } from "lucide-react"
import { getUser } from "@/lib/api"
import { useTelegram } from "@/components/providers/telegram-provider"
import { Card, CardContent } from "@/components/ui/card"

const ADMIN_IDS = [190796855, 1322880441]

const PurchaseDialog = dynamic(
  () => import("./purchase-dialog").then(m => ({ default: m.PurchaseDialog })),
  { ssr: false }
)
const TagStatsDrawer = dynamic(
  () => import("./tag-stats-drawer").then(m => ({ default: m.TagStatsDrawer })),
  { ssr: false }
)

const plans = [
  {
    id: "starter",
    name: "Начинающий",
    credits: 1000,
    price: "790 ₽",
    priceValue: 790,
    popular: false,
    icon: Zap,
    perCredit: "0.79 ₽",
  },
  {
    id: "creator",
    name: "Создатель",
    credits: 10000,
    price: "4 900 ₽",
    priceValue: 4900,
    popular: true,
    icon: Crown,
    perCredit: "0.49 ₽",
  },
  {
    id: "pro",
    name: "Про",
    credits: 105000,
    price: "45 900 ₽",
    priceValue: 45900,
    popular: false,
    icon: Gem,
    perCredit: "0.44 ₽",
  },
]

export function ShopTab() {
  const { user } = useTelegram()
  const isAdmin = ADMIN_IDS.includes(user?.id ?? 0)
  const [balance, setBalance] = useState<number | null>(null)
  const [creditsExpireAt, setCreditsExpireAt] = useState<string | null>(null)

  useEffect(() => {
    getUser().then((user) => {
      if (user) {
        setBalance(user.balance)
        setCreditsExpireAt(user.credits_expire_at ?? null)
      }
    })
  }, [])

  const [selectedPlan, setSelectedPlan] = useState<(typeof plans)[0] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [animatingCard, setAnimatingCard] = useState<string | null>(null)
  const [addedCredits, setAddedCredits] = useState<number | null>(null)
  const balanceAnimating = addedCredits !== null
  const [statsOpen, setStatsOpen] = useState(false)

  const handlePlanClick = useCallback((plan: (typeof plans)[0]) => {
    setAnimatingCard(plan.name)
    setTimeout(() => {
      setAnimatingCard(null)
      setSelectedPlan(plan)
      setDialogOpen(true)
    }, 200)
  }, [])

  const handlePurchaseComplete = useCallback((credits: number) => {
    setAddedCredits(credits)
    setBalance((prev) => (prev ?? 0) + credits)

    // Update expiration date (new purchase = +30 days from now)
    const newExpiry = new Date()
    newExpiry.setDate(newExpiry.getDate() + 30)
    setCreditsExpireAt(newExpiry.toISOString())

    setTimeout(() => {
      setAddedCredits(null)
    }, 1500)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* Balance Card */}
      <Card className="relative w-full overflow-hidden border-[#c8ff00]/15 bg-transparent shadow-none">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a2a00] to-[#0d1200]" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#c8ff00]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <CardContent className="relative p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-white/40 mb-1">Ваш баланс</p>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-bold text-white transition-[transform,color] duration-500 ${balanceAnimating ? "scale-110 text-[#c8ff00]" : "scale-100"
                    }`}
                  style={{ display: "inline-block", transformOrigin: "left bottom" }}
                >
                  {balance ?? "—"}
                </span>
                <span className="text-sm text-white/40">кредитов</span>
              </div>

              {/* Added credits toast */}
              {addedCredits !== null && (
                <div className="mt-1.5 animate-fadeSlideUp">
                  <span className="text-xs font-semibold text-[#c8ff00]">
                    +{addedCredits} начислено
                  </span>
                </div>
              )}

              {/* Expiration date */}
              {creditsExpireAt && balance !== null && balance > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Clock className="w-3 h-3 text-white/25" />
                  <span className="text-[10px] text-white/35">
                    Действуют до {new Date(creditsExpireAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                  </span>
                </div>
              )}

            </div>

            <div className="w-10 h-10 rounded-full bg-[#c8ff00]/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#c8ff00]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 px-1">Купить кредиты</h3>
        <div className="flex flex-col gap-3">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isAnimating = animatingCard === plan.name
            return (
              <button
                type="button"
                key={plan.id}
                onClick={() => handlePlanClick(plan)}
                className={`relative w-full flex items-center gap-4 p-4 rounded-2xl border transition-[transform,background-color,border-color] duration-200 active:scale-[0.97] ${plan.popular
                  ? "bg-[#c8ff00]/5 border-[#c8ff00]/15 hover:bg-[#c8ff00]/10"
                  : "bg-[#161616] border-white/[0.06] hover:bg-[#1c1c1c]"
                  } ${isAnimating ? "scale-[0.97] brightness-125" : ""}`}
              >
                {plan.popular && (
                  <span className="absolute -top-2 right-3 text-[10px] font-bold bg-[#c8ff00] text-black px-2 py-0.5 rounded-full shadow-[0_0_12px_rgba(200,255,0,0.3)]">
                    Выбор пользователей
                  </span>
                )}

                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${plan.popular
                    ? "bg-[#c8ff00]/10"
                    : "bg-white/[0.06]"
                    }`}
                >
                  <Icon
                    className={`w-5 h-5 ${plan.popular ? "text-[#c8ff00]" : "text-white/50"
                      }`}
                  />
                </div>

                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white">{plan.name}</p>
                  <p className="text-[10px] text-white/35 truncate">{plan.credits.toLocaleString("ru-RU")} кредитов · на 1 мес.</p>
                </div>

                <div className="text-right">
                  <span className="text-[15px] font-bold text-white">{plan.price}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Referral Stats — admin only */}
      {isAdmin && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="w-full relative overflow-hidden p-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] active:scale-[0.98] transition-[transform,background-color]"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#c8ff00]/[0.04] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#c8ff00]/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-[#c8ff00]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white">Реферальная статистика</p>
                <p className="text-[10px] text-white/35">Создайте теги и отслеживайте конверсии</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
            </div>
          </button>
        </div>
      )}

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        plan={selectedPlan}
        onComplete={handlePurchaseComplete}
      />

      {/* Tag Stats Drawer */}
      <TagStatsDrawer
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
      />

      {/* FAQ Section */}
      <div className="mt-1 mb-2">
        <h3 className="text-sm font-bold text-white mb-3 px-1">Частые вопросы</h3>
        <div className="flex flex-col gap-2">
          <FaqItem
            icon={<Timer className="w-4 h-4 text-[#f59e0b]" />}
            question="Какой срок действия кредитов?"
            answer="Кредиты действуют 30 дней с момента покупки. По истечении срока неиспользованные кредиты аннулируются."
          />
          <FaqItem
            icon={<ShieldCheck className="w-4 h-4 text-[#22d3ee]" />}
            question="Безопасны ли мои данные?"
            answer="Мы не храним загруженные видео и изображения после генерации. Ваши файлы не передаются третьим лицам и используются исключительно для обработки запроса."
          />
          <FaqItem
            icon={<HelpCircle className="w-4 h-4 text-[#a78bfa]" />}
            question="Что если генерация не удалась?"
            answer="Если генерация завершилась ошибкой, кредиты будут автоматически возвращены на ваш баланс. Мы гарантируем честное списание."
          />
        </div>
      </div>
    </div>
  )
}

/* ── FAQ Accordion Item ── */
function FaqItem({ icon, question, answer }: { icon: React.ReactNode; question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setOpen(v => !v)}
      className="w-full text-left p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] transition-[background-color] hover:bg-white/[0.05]"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="flex-1 text-[13px] font-medium text-white/80">{question}</span>
        <ChevronDown className={`w-4 h-4 text-white/20 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <p className="mt-2.5 ml-11 text-[12px] leading-[1.5] text-white/40">
          {answer}
        </p>
      )}
    </button>
  )
}
