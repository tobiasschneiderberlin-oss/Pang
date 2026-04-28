import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AnalyticsProvider } from '@/components/analytics-provider'
import { AccentProvider } from '@/components/accent-provider'
import { AuthProvider } from '@/components/auth-provider'
import { PostHogProvider } from '@/components/posthog-provider'
import { SwRegistrar } from '@/components/sw-registrar'
import './globals.css'

const geistSans = Geist({ 
  subsets: ["latin"],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'PANG',
  description: 'The iPod for art. Your collection, beautifully presented.',
  generator: 'PANG',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PANG',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.jpg', sizes: '192x192', type: 'image/jpeg' },
      { url: '/icons/icon-512.jpg', sizes: '512x512', type: 'image/jpeg' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.jpg', sizes: '180x180', type: 'image/jpeg' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#f7f6f4' },
    { media: '(prefers-color-scheme: light)', color: '#f7f6f4' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased min-h-dvh">
        <AnalyticsProvider />
        <AccentProvider />
        <SwRegistrar />
        <AuthProvider>
          <PostHogProvider>
            {children}
          </PostHogProvider>
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
