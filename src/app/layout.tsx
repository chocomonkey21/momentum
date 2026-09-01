import type { Metadata, Viewport } from 'next';
import { Archivo, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { BottomTabBar, Sidebar } from '@/components/ui/Nav';
import { ToastHost } from '@/components/ui/Toast';

/**
 * Type system — three faces, three distinct jobs.
 *
 *  Archivo (700–900) — the display voice. A grotesque with slightly squared
 *    terminals and tight apertures that stays confident at 72px without the
 *    novelty of a true condensed/impact face. Screen titles, hero numerals,
 *    onboarding headlines.
 *  Inter (400–600) — the UI voice. Optimised for small sizes, so list rows,
 *    buttons, body copy and metadata stay quiet and legible under the display
 *    face rather than competing with it.
 *  JetBrains Mono (500) — the data voice. Uppercase, wide-tracked, used only
 *    for axis labels, stat eyebrows and metric footers so numeric surfaces read
 *    as instrumentation.
 *
 * Archivo and Inter share grotesque skeletons, so the pairing reads as one
 * family with a weight jump rather than two competing personalities; the mono
 * supplies the contrast.
 *
 * This supersedes design-system.md §2.2's condensed/impact face and its
 * three-moment restriction, per an explicit direction change from the client
 * with visual references. The scoping principle survives — the display face is
 * still never used on list rows or body copy.
 */
const displayFace = Archivo({
  weight: ['600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
});

const uiFace = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const dataFace = JetBrains_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-face',
});

export const metadata: Metadata = {
  title: 'Momentum — Build better days',
  description:
    'A habit tracker built on a decaying momentum score instead of an all-or-nothing streak.',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  // Do not lock zoom — the layout must respect the browser's font-size settings.
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${displayFace.variable} ${uiFace.variable} ${dataFace.variable}`}
    >
      <body className="bg-bg-primary text-label-primary antialiased">
        <AppProvider>
          <Sidebar />
          {children}
          <BottomTabBar />
          <ToastHost />
        </AppProvider>
      </body>
    </html>
  );
}
