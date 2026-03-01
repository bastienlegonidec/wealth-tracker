import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Patrimoine LE GONIDEC',
  description: 'Agrégateur patrimonial personnel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
}
