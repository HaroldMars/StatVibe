import Image from 'next/image';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  priority?: boolean;
}

export function BrandLogo({
  size = 36,
  showWordmark = true,
  className = '',
  priority = false,
}: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo-main.png"
        alt="StatVibe"
        width={size}
        height={size}
        priority={priority}
        className="rounded-lg"
      />
      {showWordmark && (
        <span className="font-display text-xl font-semibold tracking-tight text-leaf-950">
          StatVibe
        </span>
      )}
    </span>
  );
}
