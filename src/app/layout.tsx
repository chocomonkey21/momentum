import type { Metadata, Viewport } from 'next';
import { Righteous, Anton, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { AuthGate } from '@/components/ui/AuthGate';

/**
 * Type system — four faces, mapped to the roles in design-system.md §2.
 *
 *  Righteous 400   — the splash wordmark ONLY, at 50px. §2.2's scoped brand
 *                    moment: one screen, one face, used nowhere else.
 *  Anton 400       — hero numerals. The §2.2 "brand display face" moments:
 *                    momentum score, streak counts, timer digits.
 *  Roboto Condensed 700 — the bold rows of the §2.1 scale: Large Title,
 *                    Title 2, Headline.
 *  Inter 400/500 — everything you read: body, list rows, form labels,
 *                    secondary copy, and the tiny uppercase stat labels.
 *                    Roboto Condensed Light was too tight at body sizes;
 *                    condensed is now reserved for headlines and numerals.
 *
 * Only the families changed; every size and letter-spacing rule still comes
 * from design-system.md §2.
 *
 * Stat labels (the small half of every stat pair) are Inter 500 uppercase with
 * wide tracking — quiet enough to never compete with the numeral above them.
 */
const wordmarkFace = Righteous({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-wordmark',
});

const heroFace = Anton({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-hero',
});

/**
 * Space Grotesk carries everything that isn't a numeral or the wordmark:
 * bold for headlines, buttons and tab labels, regular for body copy. It has
 * enough character in its a / y / G to feel designed, and enough discipline
 * to hold a settings screen. (Replaces Roboto Condensed Bold + Inter.)
 */
const uiFace = Space_Grotesk({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
      className={`${wordmarkFace.variable} ${heroFace.variable} ${uiFace.variable}`}
    >
      <body className="bg-ink1 text-label-primary antialiased">
        <AuthProvider>
          <AppProvider>
          {/*
            One phone-width column at every viewport. The client asked for a
            consistent vertical app presentation rather than the responsive
            desktop layout design-system.md §3 originally specified, so there is
            no sidebar and no multi-column breakpoint — a wide screen shows the
            same app, centred, with the surrounding page reading as inert
            backdrop rather than empty dead space.
          */}
          <div className="relative mx-auto min-h-dvh w-full max-w-[440px] bg-bg-primary sm:border-x sm:border-white/[0.07]">
            <AuthGate>{children}</AuthGate>
          </div>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
