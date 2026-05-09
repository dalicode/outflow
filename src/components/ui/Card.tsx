import { type ReactNode } from "react";

type CardVariant = "default" | "elevated" | "minimal" | "flat";

const variantStyles: Record<CardVariant, string> = {
  default:
    "bg-theme-surface rounded-theme-large shadow-sm p-4 md:p-5",
  elevated:
    "bg-theme-surface rounded-theme-large shadow-md p-4 md:p-5 transition-shadow duration-200 hover:shadow-lg",
  minimal: "bg-theme-surface rounded-theme-large p-4 md:p-5",
  flat: "bg-theme-surface rounded-theme-large border border-theme-border p-4 md:p-5",
};

interface CardProps {
  title?: string;
  children?: ReactNode;
  className?: string;
  variant?: CardVariant;
  actions?: ReactNode;
}

export default function Card({
  title,
  children,
  className = "",
  variant = "default",
  actions,
}: CardProps) {
  const baseClass = variantStyles[variant] || variantStyles.default;

  return (
    <section className={`${baseClass} ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h2 className="text-sm font-semibold text-theme-text tracking-tight">
              {title}
            </h2>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
