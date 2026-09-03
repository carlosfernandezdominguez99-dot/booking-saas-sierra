import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Cada variante incluye clases `dark:` para cuando el botón vive dentro de
// un contenedor con className="dark" (landing, login, registro) — el
// dashboard nunca tiene ese ancestro, así que se queda con el estilo claro
// de siempre.
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-300 " +
    "dark:bg-brand-500 dark:text-ink-950 dark:shadow-[0_0_30px_-6px_theme(colors.brand.500)] dark:hover:bg-brand-400 dark:hover:shadow-[0_0_40px_-4px_theme(colors.brand.400)] dark:active:bg-brand-600 dark:disabled:bg-brand-900 dark:disabled:text-brand-500/50 dark:disabled:shadow-none",
  secondary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-200 " +
    "dark:shadow-[0_0_30px_-8px_theme(colors.brand.400)]",
  outline:
    "border border-ink-200 bg-white text-ink-900 hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-300 " +
    "dark:border-white/15 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/10 dark:active:bg-white/15",
  ghost:
    "text-ink-700 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-300 " +
    "dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-13 px-6 text-base rounded-xl",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150",
          "hover:-translate-y-0.5 active:translate-y-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:hover:translate-y-0",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
