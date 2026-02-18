"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { X, CreditCard, Sparkles, Loader2, AlertCircle } from "lucide-react"
import { createPayment, verifyPayment } from "@/lib/api"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

/* global YooMoneyCheckoutWidget */
declare global {
  interface Window {
    YooMoneyCheckoutWidget: new (config: {
      confirmation_token: string
      return_url?: string
      customization?: {
        modal?: boolean
        colors?: {
          control_primary?: string
          background?: string
        }
      }
      error_callback?: (error: unknown) => void
    }) => {
      render: (containerId?: string) => Promise<void>
      destroy: () => void
      on: (event: string, callback: () => void) => void
    }
  }
}

interface Plan {
  id: string
  name: string
  credits: number
  price: string
  priceValue: number
  popular: boolean
}

interface PurchaseDialogProps {
  open: boolean
  onClose: () => void
  plan: Plan | null
  onComplete: (credits: number) => void
}

type Step = "confirm" | "loading" | "widget" | "success" | "error"

export function PurchaseDialog({ open, onClose, plan, onComplete }: PurchaseDialogProps) {
  const [dialogState, setDialogState] = useState<{ step: Step; errorMsg: string }>({ step: "confirm", errorMsg: "" })
  const widgetRef = useRef<unknown>(null)
  const widgetInstanceRef = useRef<{
    render: (containerId?: string) => Promise<void>
    destroy: () => void
    on: (event: string, callback: () => void) => void
  } | null>(null)
  const paymentIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (open) {
      setDialogState({ step: "confirm", errorMsg: "" })
    } else {
      if (widgetInstanceRef.current) {
        try {
          widgetInstanceRef.current.destroy()
        } catch {
          // ignore
        }
        widgetInstanceRef.current = null
      }
    }
  }, [open])

  const initWidget = useCallback(async () => {
    if (!plan) return

    setDialogState(prev => ({ ...prev, step: "loading" }))

    // Create payment on backend → get confirmation_token
    const result = await createPayment(plan.id)
    if (!result) {
      setDialogState({ step: "error", errorMsg: "Не удалось создать платёж. Попробуйте позже." })
      return
    }

    // Save payment_id for verification after widget success
    paymentIdRef.current = result.payment_id

    // Check that widget script is loaded
    if (typeof window.YooMoneyCheckoutWidget === "undefined") {
      setDialogState({ step: "error", errorMsg: "Платёжная система не загружена. Обновите страницу." })
      return
    }

    setDialogState(prev => ({ ...prev, step: "widget" }))

    // Wait for DOM to update with the widget container
    setTimeout(() => {
      try {
        const widget = new window.YooMoneyCheckoutWidget({
          confirmation_token: result.confirmation_token,
          customization: {
            modal: true,
            colors: {
              control_primary: "#C8FF00",
              background: "#1A1A1A",
            },
          },
          error_callback: (error: unknown) => {
            console.error("YooKassa widget error:", error)
            setDialogState({ step: "error", errorMsg: "Ошибка платёжной системы" })
          },
        })

        widgetInstanceRef.current = widget

        widget.on("success", async () => {
          // Payment succeeded in widget — verify on backend to credit user
          setDialogState(prev => ({ ...prev, step: "success" }))

          // Call verify endpoint to ensure credits are applied
          if (paymentIdRef.current) {
            try {
              await verifyPayment(paymentIdRef.current)
            } catch (err) {
              console.error("Payment verify error:", err)
            }
          }

          setTimeout(() => {
            onComplete(plan.credits)
            onClose()
          }, 1800)
        })

        widget.on("fail", () => {
          setDialogState({ step: "error", errorMsg: "Платёж не прошёл. Попробуйте ещё раз." })
        })

        widget.on("modal_close", () => {
          // User closed the payment modal without completing
          if (widgetInstanceRef.current) {
            try {
              widgetInstanceRef.current.destroy()
            } catch {
              // ignore
            }
            widgetInstanceRef.current = null
          }
          setDialogState(prev => ({ ...prev, step: "confirm" }))
        })

        // modal: true means render() opens the modal itself
        widget.render()
      } catch (err) {
        console.error("Widget init error:", err)
        setDialogState({ step: "error", errorMsg: "Не удалось открыть форму оплаты" })
      }
    }, 100)
  }, [plan, onComplete, onClose])

  if (!plan) return null

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && dialogState.step === "confirm" && onClose()}>
      <DrawerContent>
        {/* Close button */}
        {(dialogState.step === "confirm" || dialogState.step === "error") && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        )}

        {/* Step: Confirm */}
        {dialogState.step === "confirm" && (
          <div className="flex flex-col items-center gap-5 pt-2">
            {/* Icon */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-[#c8ff00]/10 flex items-center justify-center">
                <CreditCard className="w-7 h-7 text-[#c8ff00]" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#c8ff00] flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-black" />
              </div>
            </div>

            {/* Plan info */}
            <div className="text-center">
              <DrawerTitle>Пакет &laquo;{plan.name}&raquo;</DrawerTitle>
              <DrawerDescription className="mt-1.5">
                {plan.credits} кредитов за {plan.price}
              </DrawerDescription>
            </div>

            {/* Credits breakdown */}
            <Card className="w-full border-white/[0.06] bg-white/[0.04] shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] text-white/50">Кредиты</span>
                  <span className="text-[13px] font-semibold text-white">{plan.credits}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] text-white/50">Цена за кредит</span>
                  <span className="text-[13px] font-semibold text-white">
                    {(plan.priceValue / plan.credits).toFixed(2)} ₽
                  </span>
                </div>
                <Separator className="bg-white/[0.06] my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-white">Итого</span>
                  <span className="text-[15px] font-bold text-[#c8ff00]">{plan.price}</span>
                </div>
              </CardContent>
            </Card>

            {/* Pay button */}
            <Button
              onClick={initWidget}
              className="w-full py-3.5 h-auto rounded-full bg-[#c8ff00] text-black font-bold text-[15px] hover:bg-[#d4ff33] active:bg-[#b8ee00] transition-[transform,background-color] shadow-[0_0_24px_rgba(200,255,0,0.25)] active:scale-[0.98]"
            >
              Оплатить {plan.price}
            </Button>

            <p className="text-[10px] text-white/25 text-center leading-relaxed">
              Оплата через безопасный шлюз ЮKassa.
              <br />
              Поддерживаются карты, SBP, SberPay, T-Pay.
            </p>
          </div>
        )}

        {/* Step: Loading (creating payment) */}
        {dialogState.step === "loading" && (
          <div className="flex flex-col items-center gap-5 pt-6 pb-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-[#c8ff00]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#c8ff00] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[#c8ff00] animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <DrawerTitle>Подготовка</DrawerTitle>
              <DrawerDescription className="mt-1.5">Создаём платёж...</DrawerDescription>
            </div>
          </div>
        )}

        {/* Step: Widget (YooKassa handles the modal itself) */}
        {dialogState.step === "widget" && (
          <div className="flex flex-col items-center gap-4 pt-6 pb-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-[#c8ff00]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#c8ff00] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-[#c8ff00]" />
              </div>
            </div>
            <DrawerDescription>Завершите оплату в форме YooKassa</DrawerDescription>
          </div>
        )}

        {/* Step: Success */}
        {dialogState.step === "success" && (
          <div className="flex flex-col items-center gap-5 pt-6 pb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-[#c8ff00]/15 flex items-center justify-center animate-successPop">
                <Sparkles className="w-8 h-8 text-[#c8ff00]" />
              </div>
              {/* Sparkle particles */}
              <div className="absolute -top-2 -left-2 w-2 h-2 rounded-full bg-[#c8ff00] animate-sparkle1" />
              <div className="absolute -top-1 -right-3 w-1.5 h-1.5 rounded-full bg-[#c8ff00] animate-sparkle2" />
              <div className="absolute -bottom-2 -left-3 w-1 h-1 rounded-full bg-[#c8ff00] animate-sparkle3" />
              <div className="absolute -bottom-1 -right-2 w-1.5 h-1.5 rounded-full bg-[#c8ff00] animate-sparkle4" />
            </div>
            <div className="text-center">
              <DrawerTitle>Готово!</DrawerTitle>
              <DrawerDescription className="mt-1.5">
                +{plan.credits} кредитов добавлено
              </DrawerDescription>
            </div>
          </div>
        )}

        {/* Step: Error */}
        {dialogState.step === "error" && (
          <div className="flex flex-col items-center gap-5 pt-6 pb-4">
            <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="text-center">
              <DrawerTitle>Ошибка</DrawerTitle>
              <DrawerDescription className="mt-1.5">{dialogState.errorMsg}</DrawerDescription>
            </div>
            <Button
              onClick={() => setDialogState(prev => ({ ...prev, step: "confirm" }))}
              variant="ghost"
              className="w-full py-3 h-auto rounded-full bg-white/10 text-white font-semibold text-[14px] hover:bg-white/15 transition-[transform,background-color] active:scale-[0.98]"
            >
              Попробовать ещё раз
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
