import Image from 'next/image';

export function BrandLogo({ href = '/play' }: { href?: string }) {
  return (
    <a href={href} className="wordmark" aria-label="ScaleSquad home">
      <Image
        src="/icons/squad-link.svg"
        width={44}
        height={44}
        className="wordmark-mark"
        alt=""
        unoptimized
      />
      <span className="wordmark-name">
        SCALE<span className="wordmark-accent">SQUAD</span>
      </span>
    </a>
  );
}
