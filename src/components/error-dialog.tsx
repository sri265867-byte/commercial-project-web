"use client"

import { AlertCircle, Wallet, X } from "lucide-react"
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
    DrawerDescription,
} from "@/components/ui/drawer"

interface ErrorDialogProps {
    open: boolean
    onClose: () => void
    type: "insufficient_credits" | "upload_failed" | "generation_failed" | "unknown"
    creditsNeeded?: number
    creditsHave?: number
    message?: string
    onGoToShop?: () => void
}

export function ErrorDialog({
    open,
    onClose,
    type,
    creditsNeeded,
    creditsHave,
    message,
    onGoToShop,
}: ErrorDialogProps) {
    const getContent = () => {
        switch (type) {
            case "insufficient_credits":
                return {
                    icon: <Wallet className="w-8 h-8 text-[#ff6b6b]" />,
                    title: "Недостаточно кредитов",
                    description: `Вам нужно ${creditsNeeded} кредитов, но у вас ${creditsHave}`,
                    action: "Пополнить баланс",
                    onAction: () => {
                        onGoToShop?.()
                        onClose()
                    },
                }
            case "upload_failed":
                return {
                    icon: <AlertCircle className="w-8 h-8 text-[#ff6b6b]" />,
                    title: "Ошибка загрузки",
                    description: message || "Не удалось загрузить файл. Пожалуйста, попробуйте еще раз.",
                    action: "Закрыть",
                    onAction: onClose,
                }
            case "generation_failed":
                return {
                    icon: <AlertCircle className="w-8 h-8 text-[#ff6b6b]" />,
                    title: "Ошибка генерации",
                    description: message || "Произошла ошибка во время создания видео.",
                    action: "Закрыть",
                    onAction: onClose,
                }
            default:
                return {
                    icon: <AlertCircle className="w-8 h-8 text-[#ff6b6b]" />,
                    title: "Ошибка",
                    description: message || "Произошла неизвестная ошибка.",
                    action: "Закрыть",
                    onAction: onClose,
                }
        }
    }

    const content = getContent()

    return (
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DrawerContent>
                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
                >
                    <X className="w-4 h-4 text-white/60" />
                </button>

                {/* Content */}
                <div className="flex flex-col items-center gap-4 pt-2">
                    <div className="w-16 h-16 rounded-full bg-[#ff6b6b]/10 flex items-center justify-center">
                        {content.icon}
                    </div>

                    <div className="text-center">
                        <DrawerTitle>{content.title}</DrawerTitle>
                        <DrawerDescription className="mt-1.5 leading-relaxed">
                            {content.description}
                        </DrawerDescription>
                    </div>

                    {type === "insufficient_credits" ? (
                        <button
                            type="button"
                            onClick={content.onAction}
                            className="w-full py-3.5 rounded-full bg-[#c8ff00] text-black font-bold text-[15px] hover:bg-[#d4ff33] active:bg-[#b8ee00] transition-colors shadow-[0_0_24px_rgba(200,255,0,0.25)] mt-2"
                        >
                            {content.action}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={content.onAction}
                            className="w-full py-3.5 rounded-full bg-white/10 text-white font-semibold text-[15px] hover:bg-white/15 active:bg-white/8 transition-colors mt-2"
                        >
                            {content.action}
                        </button>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
