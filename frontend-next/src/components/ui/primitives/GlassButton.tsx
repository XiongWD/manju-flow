import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ')
}

const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    iconLeft,
    iconRight,
    className,
    children,
    disabled,
    ...props
  },
  ref
) {
  const variantClass =
    variant === 'primary' ? 'glass-btn-primary' :
      variant === 'ghost' ? 'glass-btn-ghost' :
        variant === 'danger' ? 'glass-btn-danger' :
          'glass-btn-secondary'

  const sizeClass =
    size === 'sm' ? 'h-8 px-3 text-xs' :
      size === 'lg' ? 'h-11 px-5 text-base' :
        'h-9 px-4 text-sm'

  return (
    <button
      ref={ref}
      className={cx('glass-btn-base', variantClass, sizeClass, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  )
})

export default GlassButton
