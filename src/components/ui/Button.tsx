import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import type { ReactNode } from 'react'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'success' | 'secondary' | 'ghost'
    icon?: ReactNode
  }
>

export function Button({
  children,
  className = '',
  variant = 'primary',
  icon,
  ...props
}: ButtonProps) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  )
}
