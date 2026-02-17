import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from "next/script"
import { TelegramProvider } from "@/components/providers/telegram-provider"

import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Video Generator',
  description: 'AI Video Generation Mini App',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} font-sans antialiased min-h-screen bg-background overflow-x-hidden`}>
        <Script
          src="https://telegram.org/js/telegram-web-app.js?59"
          strategy="beforeInteractive"
        />
        <Script
          src="https://yookassa.ru/checkout-widget/v1/checkout-widget.js"
          strategy="afterInteractive"
        />
        <TelegramProvider>
          {children}
        </TelegramProvider>
      </body>
    </html>
  )
}
