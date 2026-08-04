import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'surface' | 'ghost' | 'positive' | 'negative' | 'neutral';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Nimmt die volle Breite ein – der Normalfall auf dem Handy. */
  block?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-[#20180a] hover:brightness-110 active:brightness-95 font-bold',
  surface: 'bg-surface-2 text-ink border border-line hover:border-felt-line active:brightness-95',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-surface-2',
  positive: 'bg-win text-[#05231a] hover:brightness-110 active:brightness-95 font-bold',
  negative: 'bg-loss text-[#2a0910] hover:brightness-110 active:brightness-95 font-bold',
  neutral: 'bg-tie text-[#2a1e05] hover:brightness-110 active:brightness-95 font-bold',
};

/** Mindesthöhen so gewählt, dass jede Fläche bequem mit dem Daumen zu treffen ist. */
const SIZES: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm rounded-lg',
  md: 'min-h-12 px-4 text-base rounded-xl',
  lg: 'min-h-14 px-5 text-lg rounded-xl',
  xl: 'min-h-16 px-6 text-xl rounded-2xl',
};

export function Button({
  variant = 'surface',
  size = 'md',
  block,
  icon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-2 transition',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
}
