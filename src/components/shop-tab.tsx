"use client"

import { useState, useEffect, useCallback } from "react"
import { Sparkles, Zap, Crown, Gem } from "lucide-react"
import { getUser } from "@/lib/api"
import { PurchaseDialog } from "./purchase-dialog"
import { Card, CardContent } from "@/components/ui/card"

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
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    getUser().then((user) => {
      if (user) setBalance(user.balance)
    })
  }, [])

  const [selectedPlan, setSelectedPlan] = useState<(typeof plans)[0] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [animatingCard, setAnimatingCard] = useState<string | null>(null)
  const [balanceAnimating, setBalanceAnimating] = useState(false)
  const [addedCredits, setAddedCredits] = useState<number | null>(null)

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
    setBalanceAnimating(true)
    setBalance((prev) => (prev ?? 0) + credits)

    setTimeout(() => {
      setBalanceAnimating(false)
      setAddedCredits(null)
    }, 1500)
  }, [])

  return (
    <div className="flex flex-col gap-4 pb-6">
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
                  className={`text-3xl font-bold text-white transition-all duration-500 ${balanceAnimating ? "scale-110 text-[#c8ff00]" : "scale-100"
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
                className={`relative w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.97] ${plan.popular
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
                  <p className="text-[10px] text-white/35 truncate">{plan.credits.toLocaleString("ru-RU")} кредитов · {plan.perCredit}/кредит</p>
                </div>

                <div className="text-right">
                  <span className="text-[15px] font-bold text-white">{plan.price}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        plan={selectedPlan}
        onComplete={handlePurchaseComplete}
      />
    </div>
  )
}
