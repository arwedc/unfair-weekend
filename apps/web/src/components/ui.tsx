import type { ComponentProps, ReactNode } from 'react';

/** Kleine Bausteine mit den semantischen Tokens aus @repo/shared (über Tailwind-Theme). */

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const buttonBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-5 text-subhead font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-60';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-solid text-accent-on-solid hover:bg-accent-solid-pressed',
  secondary:
    'border border-border-strong bg-surface-default text-text-primary hover:bg-background-muted',
  ghost: 'text-text-secondary hover:bg-background-muted hover:text-text-primary',
};

export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${buttonBase} ${buttonVariants[variant]} ${extra}`;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export const inputClass =
  'block w-full rounded-input border border-border-default bg-surface-default px-3.5 py-2.5 text-body text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-2 focus:outline-offset-0 focus:outline-border-focus/30 aria-invalid:border-status-error-solid';

export function Field({
  id,
  label,
  hint,
  error,
  children,
  className = '',
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-subhead text-text-primary">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-footnote text-status-error-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-footnote text-text-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={`rounded-card border border-border-subtle bg-surface-raised shadow-card ${className}`}
      {...props}
    />
  );
}
