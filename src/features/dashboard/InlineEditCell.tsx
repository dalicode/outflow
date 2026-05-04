import { useState, useEffect, useRef } from "react";
import { cn } from "../../utils/cn";

interface InlineEditCellProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  onTab?: (shiftKey: boolean) => void;
  validate?: (value: string) => string | null;
  error?: string | null;
  type?: "text" | "number";
  className?: string;
}

export default function InlineEditCell({
  initialValue,
  onCommit,
  onCancel,
  onTab,
  validate,
  error: externalError,
  type = "text",
  className,
}: InlineEditCellProps) {
  const [value, setValue] = useState(initialValue);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const displayError = localError || externalError;

  const commit = () => {
    if (validate) {
      const err = validate(value);
      if (err) {
        setLocalError(err);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
    }
    setLocalError(null);
    onCommit(value);
  };

  return (
    <div data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setLocalError(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            onTab?.(false);
          }
          if (e.key === "Tab") {
            e.preventDefault();
            commit();
            onTab?.(e.shiftKey);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        className={cn(
          "input-inline",
          displayError && "border-theme-danger",
          className,
        )}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
      />
      {displayError && (
        <p className="text-theme-danger text-[10px] mt-0.5 leading-tight">
          {displayError}
        </p>
      )}
    </div>
  );
}
