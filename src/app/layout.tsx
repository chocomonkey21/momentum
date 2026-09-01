import type { Metadata, Viewport } from 'next';
import { Anton } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { BottomTabBar, Sidebar } from '@/components/ui/Nav';
import { ToastHost } from '@/components/ui/Toast';

/**
 * Brand display face. design-system.md §2.2 says to keep "your existing
 * condensed/impact face" but never names a web-available font.
 * ASSUMPTION: Anton is the closest freely-hostable web equivalent to the
 * condensed/impact treatment in the references. It is exposed only through the
 * `.font-display` / `.font-display-hero` classes, which are used in exactly the
 * three scoped moments (wordmark, hero stat numbers, onboarding headlines) —
 * never on list rows, buttons or body copy.
 */
const displayFace = Anton({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
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
    <html lang="en" className={displayFace.variable}>
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
