import type { Metadata, Viewport } from 'next'

// Co-locate function execution with the Supabase project (eu-west-1
// Ireland) so Drizzle queries don't cross the Atlantic on every render.
// fra1 = Frankfurt; ~5ms RTT to eu-west-1 vs ~80ms+ from iad1.
// Default 'auto' was deploying to iad1 and timing out cold-start
// /collection requests at 300s.
export const preferredRegion = ["fra1"];
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AnalyticsProvider } from '@/components/analytics-provider'
import { AccentProvider } from '@/components/accent-provider'
import { AuthProvider } from '@/components/auth-provider'
import { PostHogProvider } from '@/components/posthog-provider'
import { SwRegistrar } from '@/components/sw-registrar'
import { InstallPrompt } from '@/components/install-prompt'
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
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
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
        <InstallPrompt />
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
