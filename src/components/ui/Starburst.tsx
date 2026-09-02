import { cn } from '@/lib/cn';

/**
 * The app's one decorative mark.
 *
 * Empty states, onboarding and loading need *something* in the space where a
 * lesser app would put an illustration, a 3D render or an emoji. This is that
 * something: an abstract eight-point burst built from four flat strokes
 * crossing at a point, with the diagonals shortened so it reads as a star
 * rather than a snowflake.
 *
 * Deliberately geometric and monochrome — it inherits `currentColor`, carries
 * no gradient, and never becomes the loudest thing on a screen.
 */
export function Starburst({
  size = 48,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
        {/* Cardinals run the full width; diagonals are inset, which is what
            gives the mark its star silhouette instead of a plus-in-a-cross. */}
        <line x1="24" y1="2" x2="24" y2="46" />
        <line x1="2" y1="24" x2="46" y2="24" />
        <line x1="9" y1="9" x2="39" y2="39" />
        <line x1="39" y1="9" x2="9" y2="39" />
      </g>
    </svg>
  );
}

/**
 * Solid-fill variant, for when the mark sits on a coloured block and a line
 * drawing would look thin against it.
 */
export function StarburstSolid({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Four tapered points, drawn as one path so the centre stays solid. */}
      <path
        fill="currentColor"
        d="M24 0 L28.5 19.5 L48 24 L28.5 28.5 L24 48 L19.5 28.5 L0 24 L19.5 19.5 Z"
      />
    </svg>
  );
}
