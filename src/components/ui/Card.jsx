import React from "react";

const variantStyles = {
  default:
    "bg-theme-surface rounded-xl shadow-sm p-4 md:p-5",
  elevated:
    "bg-theme-surface rounded-xl shadow-md p-4 md:p-5 transition-shadow duration-200 hover:shadow-lg",
  minimal: "bg-theme-surface rounded-xl p-4 md:p-5",
};

export default function Card({
  title,
  children,
  className = "",
  variant = "default",
  actions,
}) {
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
