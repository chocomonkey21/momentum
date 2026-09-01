import { Screen, ScreenHeader } from '@/components/ui/Screen';

export default function Page() {
  return (
    <Screen>
      <ScreenHeader title={'Profile'} />
      <p className="text-body text-label-secondary">Coming up next in the build.</p>
    </Screen>
  );
}
