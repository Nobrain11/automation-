import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SolanaProvider } from '@/components/wallet-provider'

export const metadata: Metadata = {
  title: 'PUMP AUTO | Trading Terminal',
  description: 'Operator console for automated trading workflows.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#080b10',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="bg-background"><body className="antialiased"><SolanaProvider>{children}</SolanaProvider>{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
