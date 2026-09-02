import { cn } from '@/lib/cn';

/**
 * The stat pattern, used everywhere a number matters.
 *
 * One huge Anton numeral, and directly beneath it a tiny uppercase
 * wide-tracked muted label. Nothing else. Applying this one shape to every
 * stat in the app — momentum, streaks, lifetime totals, the Statistics
 * headline, the calendar footer — is most of what makes the numbers read as a
 * system rather than as a pile of differently-styled figures.
 *
 * Purely presentational: it takes strings and renders them.
 */

type StatSize = 'sm' | 'md' | 'lg' | 'xl';

const VALUE_SIZE: Record<StatSize, string> = {
  sm: 'text-[28px] leading-[0.9]',
  md: 'text-[36px] leading-[0.88]',
  lg: 'text-[52px] leading-[0.86]',
  xl: 'text-[72px] leading-[0.84]',
};

export function Stat({
  value,
  label,
  size = 'md',
  align = 'left',
  /** Overrides the numeral colour; the label always stays muted. */
  valueColor,
  /** Muted label colour, for use on a filled colour block. */
  labelClassName,
  suffix,
  className,
}: {
  value: string | number;
  label: string;
  size?: StatSize;
  align?: 'left' | 'right' | 'center';
  valueColor?: string;
  labelClassName?: string;
  suffix?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col',
        align === 'right' && 'items-end text-right',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      <span
        className={cn('font-display-hero', VALUE_SIZE[size])}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
        {suffix}
      </span>
      <span className={cn('font-data mt-2 text-label-tertiary', labelClassName)}>{label}</span>
    </div>
  );
}
