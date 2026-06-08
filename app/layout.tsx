import type { Metadata, Viewport } from 'next'
import { DriveProvider } from '@/components/layout/DriveProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Property Tracker',
  description: 'Research and track property investments',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Property Tracker' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Serif+Display&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css" />
      </head>
      <body>
        <DriveProvider>
          {children}
        </DriveProvider>
      </body>
    </html>
  )
}
