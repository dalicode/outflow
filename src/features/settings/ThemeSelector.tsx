import { cn } from "../../utils/cn";
import { THEMES } from "../../utils/themeConfig";
import type { ThemeConfig } from "../../types";

const themePreviews: Record<
  string,
  {
    background: string;
    border: string;
    primary: string;
    text: string;
    isDark: boolean;
  }
> = {
  default: {
    background: "#f1f5f9",
    border: "#cbd5e1",
    primary: "#334155",
    text: "#0f172a",
    isDark: false,
  },
  sharpProfessionalDark: {
    background: "#0f172a",
    border: "#334155",
    primary: "#94a3b8",
    text: "#f1f5f9",
    isDark: true,
  },
  darkMinimal: {
    background: "#09090b",
    border: "#27272a",
    primary: "#a1a1aa",
    text: "#fafafa",
    isDark: true,
  },
  runescapeClassic: {
    background: "#2b2118",
    border: "#4a3728",
    primary: "#c9a34e",
    text: "#eadfcb",
    isDark: true,
  },
};

interface ThemeCardProps {
  theme: ThemeConfig;
  isSelected: boolean;
  onClick: () => void;
}

function ThemeCard({ theme, isSelected, onClick }: ThemeCardProps) {
  const preview = themePreviews[theme.id] || themePreviews.default;
  const radiusMap: Record<string, string> = {
    default: "2px",
    sharpProfessionalDark: "2px",
    darkMinimal: "6px",
    runescapeClassic: "6px",
  };
  const cardRadius = radiusMap[theme.id] || "8px";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-shrink-0 w-28 sm:w-32 p-2 rounded-theme-large border-2 transition-all text-left snap-start",
        isSelected
          ? "border-theme-primary ring-2 ring-theme-primary/30"
          : "border-transparent hover:border-theme-border",
      )}
      style={{ background: preview.background }}
    >
      <div
        className="h-14 border overflow-hidden"
        style={{
          borderRadius: cardRadius,
          backgroundColor: preview.isDark ? "#18181b" : "#ffffff",
          borderColor: preview.border,
        }}
      >
        <div className="flex gap-1 p-1.5">
          <div
            className="h-1.5 flex-1"
            style={{
              backgroundColor: preview.primary,
              opacity: 0.7,
              borderRadius: cardRadius,
            }}
          />
          <div
            className="h-1.5 flex-1"
            style={{
              backgroundColor: preview.primary,
              opacity: 0.4,
              borderRadius: cardRadius,
            }}
          />
        </div>
        <div className="px-1.5 space-y-1">
          <div
            className="h-1.5 w-3/4"
            style={{
              backgroundColor: preview.border,
              borderRadius: cardRadius,
            }}
          />
          <div
            className="h-1.5 w-1/2"
            style={{
              backgroundColor: preview.primary,
              opacity: 0.8,
              borderRadius: cardRadius,
            }}
          />
        </div>
      </div>
      <p
        className="text-[11px] mt-1.5 text-center font-medium truncate"
        style={{ color: preview.text }}
      >
        {theme.name}
      </p>
      <div className="flex gap-1 justify-center mt-0.5">
        <span
          className="text-[9px] px-1 py-0.5 rounded-theme-small font-medium"
          style={{
            backgroundColor: preview.primary,
            color: "#fff",
            opacity: 0.9,
          }}
        >
          {theme.borderRadius.large}
        </span>
      </div>
    </button>
  );
}

interface ThemeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const themeList = Object.values(THEMES) as ThemeConfig[];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
      {themeList.map((theme) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          isSelected={value === theme.id}
          onClick={() => onChange(theme.id)}
        />
      ))}
    </div>
  );
}
