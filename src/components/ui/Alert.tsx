import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "error" | "success" | "info";

const toneClasses: Record<Tone, string> = {
  error: "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20",
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  info: "bg-brand-50 text-brand-700 border-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/20",
};

export function Alert({
  tone = "info",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "animate-fade-in rounded-xl border px-4 py-3 text-sm",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
