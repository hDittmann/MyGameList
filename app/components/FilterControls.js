"use client";

export function FilterPill({ active, disabled, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`cursor-pointer border-2 px-3 py-2 text-xs uppercase tracking-[0.35em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active
        ? "border-(--border-strong) bg-(--surface) text-foreground"
        : "border-(--border) bg-(--surface-muted) text-(--muted) hover:bg-(--surface) hover:text-foreground"
        }`}
    >
      {children}
    </button>
  );
}

export function FilterSelect({ value, onChange, disabled, children, title }) {
  return (
    <select
      value={String(value)}
      title={title}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      className="border-2 border-(--border) bg-(--surface) px-2 py-2 text-xs uppercase tracking-[0.35em] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </select>
  );
}

export function FilterTextInput({ value, onChange, disabled, placeholder, title }) {
  return (
    <input
      value={value}
      title={title}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted) disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

export function FilterRange({ value, onChange, onCommit, disabled, min = 0, max = 100, step = 1, title }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={Number(value) || 0}
      title={title}
      disabled={disabled}
      onChange={(e) => onChange?.(Number(e.target.value) || 0)}
      onMouseUp={() => onCommit?.(Number(value) || 0)}
      onTouchEnd={() => onCommit?.(Number(value) || 0)}
      onKeyUp={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
          onCommit?.(Number(value) || 0);
        }
      }}
      className="w-full accent-current disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

export function FilterSection({ title, children }) {
  return (
    <div className="border-2 border-(--border) bg-(--surface) p-4">
      <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">{title}</div>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </div>
  );
}
