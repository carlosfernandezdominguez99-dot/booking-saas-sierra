import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400",
          "transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-brand-400/60",
          "dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30",
          error
            ? "border-red-300 focus:ring-red-300/60 dark:border-red-400/40"
            : "border-ink-200 dark:border-white/10",
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
}
