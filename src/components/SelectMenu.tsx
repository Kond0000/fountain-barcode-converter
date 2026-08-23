import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronIcon } from "./Icons";

export type SelectMenuOption = {
  value: string;
  label: string;
};

type SelectMenuProps = {
  idPrefix: string;
  labelId: string;
  options: SelectMenuOption[];
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
};

export function SelectMenu({
  idPrefix,
  labelId,
  options,
  value,
  disabled = false,
  invalid = false,
  onChange,
}: SelectMenuProps) {
  const generatedId = useId();
  const controlId = `${idPrefix}-${generatedId.replace(/:/g, "")}`;
  const listboxId = `${controlId}-listbox`;
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const selectedIndex = Math.max(options.findIndex((option) => option.value === value), 0);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const openList = (index = selectedIndex) => {
    if (disabled || options.length === 0) return;
    setActiveIndex(index);
    setOpen(true);
  };

  const choose = (index: number) => {
    const nextValue = options[index]?.value;
    if (typeof nextValue !== "string") return;
    onChange(nextValue);
    setActiveIndex(index);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList(selectedIndex);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + options.length) % options.length);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const edgeIndex = event.key === "Home" ? 0 : options.length - 1;
      if (!open) openList(edgeIndex);
      else setActiveIndex(edgeIndex);
      return;
    }

    if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      choose(activeIndex);
    }
  };

  return (
    <div
      className={`app-select-control ${open ? "is-open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        className={`app-select-trigger ${invalid ? "is-invalid" : ""}`}
        type="button"
        role="combobox"
        aria-labelledby={labelId}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${controlId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => {
          if (open) setOpen(false);
          else openList();
        }}
        onKeyDown={handleKeyDown}
      >
        <span>{options[selectedIndex]?.label ?? "選択肢がありません"}</span>
        <ChevronIcon />
      </button>
      {open ? (
        <ul className="app-select-menu" id={listboxId} role="listbox" aria-labelledby={labelId}>
          {options.map((option, index) => (
            <li
              className={`${index === selectedIndex ? "is-selected" : ""} ${index === activeIndex ? "is-active" : ""}`}
              id={`${controlId}-option-${index}`}
              key={`${option.value}-${index}`}
              role="option"
              aria-label={option.label}
              aria-selected={index === selectedIndex}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
