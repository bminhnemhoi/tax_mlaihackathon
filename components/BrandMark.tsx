import Image from 'next/image';
import type { ReactElement } from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** Decorative alongside the Tax Referee wordmark or a labelled control. */
export function BrandMark({ size = 32, className = '' }: BrandMarkProps): ReactElement {
  return (
    <Image
      src="/brand/tax-referee-mark.png"
      width={size}
      height={size}
      alt=""
      unoptimized
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
