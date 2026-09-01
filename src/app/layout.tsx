import type { Metadata, Viewport } from 'next';
import { Righteous, Anton, Roboto_Condensed } from 'next/font/google';
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
 *  Roboto Condensed 300 — the regular rows: Body, Subheadline, Footnote,
 *                    Caption 1.
 *
 * Only the families changed; every size and letter-spacing rule still comes
 * from design-system.md §2.
 *
 * Note on the data/eyebrow role: the previous build used a monospace face for
 * axis labels and stat captions. §2 defines no mono role and this brief
 * replaces the type choices wholesale, so that role now renders in Roboto
 * Condensed Light, keeping its instrumentation read through uppercase and
 * wide tracking rather than through a fifth family.
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

const uiFace = Roboto_Condensed({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-condensed',
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
          <div className="relative mx-auto min-h-dvh w-full max-w-[440px] bg-bg-primary shadow-[0_0_80px_rgba(0,0,0,0.9)] sm:border-x sm:border-white/[0.06]">
            <AuthGate>{children}</AuthGate>
          </div>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
