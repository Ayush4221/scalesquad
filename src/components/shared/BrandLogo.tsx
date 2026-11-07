import { commonStrings } from '@/constants/strings/common';
import { layoutClassName } from '@/styles/layout';
import Image from 'next/image';

export function BrandLogo({ href = '/play' }: { href?: string }) {
  return (
    <a
      href={href}
      className={layoutClassName('wordmark')}
      aria-label={commonStrings.scalesquadHome}
    >
      <Image
        src="/icons/squad-link.svg"
        width={44}
        height={44}
        className={layoutClassName('wordmark-mark')}
        alt=""
        unoptimized
      />
      <span className={layoutClassName('wordmark-name')}>
        {commonStrings.scale}
        <span className={layoutClassName('wordmark-accent')}>{commonStrings.squadWordmark}</span>
      </span>
    </a>
  );
}
