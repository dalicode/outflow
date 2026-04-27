import React from "react";

export default function Card({ title, children, className = "" }) {
  return (
    <section
      className={`bg-theme-surface rounded-theme-large shadow-sm p-4 border border-theme-border ${className}`}
    >
      {title && (
        <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
