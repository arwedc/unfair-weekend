const sizes = {
  md: { icon: 'size-8 rounded-[9px]', text: 'text-headline', gap: 'gap-2' },
  lg: { icon: 'size-12 rounded-[13px]', text: 'text-title1', gap: 'gap-3' },
} as const;

/** Markenzeichen: Pin über dem Stamm, rechts das „<“ – zusammen ein K. */
function LogoMark({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 overflow-hidden bg-accent-solid text-accent-on-solid ${className}`}
    >
      <g fill="currentColor" stroke="currentColor" strokeLinejoin="round">
        {/* Pin mit Loch */}
        <path
          fillRule="evenodd"
          strokeWidth="2"
          d="M39 51 L28.94 35.55 A12 12 0 1 1 49.06 35.55 Z M33.5 29 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0 Z"
        />
        {/* Stamm unten links */}
        <path strokeWidth="2" d="M29 60 Q29 55 34 57 L45 75 Q48 80 42 80 L33 80 Q29 80 29 76 Z" />
      </g>
      {/* Arme des K */}
      <path
        d="M73 36 L54 56 L73 76"
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 'md' }: { size?: keyof typeof sizes }) {
  const s = sizes[size];
  return (
    <span className={`inline-flex items-center ${s.gap}`}>
      <LogoMark className={s.icon} />
      <span className={`${s.text} font-extrabold tracking-tight text-text-primary`}>Kiepn</span>
    </span>
  );
}
