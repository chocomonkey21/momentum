import { Screen, ScreenHeader } from '@/components/ui/Screen';

export default function Page() {
  return (
    <Screen width="wide">
      <ScreenHeader title="Momentum" eyebrow="Shell deploy" />
      <p className="text-body text-label-secondary">Screens are being built now.</p>
    </Screen>
  );
}
