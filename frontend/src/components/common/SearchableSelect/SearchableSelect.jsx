import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";
import "./SearchableSelect.css";

function SearchableSelect({ label, value, options = [], onChange, required = false, disabled = false, name, error = "", placeholder = "Select" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  const selected = options.find((option) => String(option.value) === String(value));
  const filtered = options.filter((option) =>
    String(option.label ?? "").toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    const outside = (event) => {
      const target = event.target;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return undefined;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportPadding = 8;
      const gap = 6;
      const minMenuHeight = 120;
      const preferredMenuHeight = 260;
      const availableBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding - gap);
      const availableAbove = Math.max(0, rect.top - viewportPadding - gap);
      const openUp = availableBelow < minMenuHeight && availableAbove > availableBelow;
      const availableSpace = openUp ? availableAbove : availableBelow;
      const maxHeight = Math.max(
        minMenuHeight,
        Math.min(preferredMenuHeight, availableSpace)
      );

      setMenuStyle({
        position: "fixed",
        zIndex: 100000,
        left: rect.left,
        width: rect.width,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, filtered.length]);

  return (
    <div className="common-form-control searchable-select-control" ref={ref}>
      {label && (
        <label htmlFor={name}>
          {label}{required && <span className="common-required"> *</span>}
        </label>
      )}

      <button
        type="button"
        id={name}
        className={"searchable-select-trigger" + (error ? " common-input-error" : "")}
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? "selected" : "placeholder"}>
          {selected?.label || placeholder}
        </span>
        <FiChevronDown size={15} />
      </button>

      {open && !disabled && createPortal(
        <div ref={menuRef} className="searchable-select-menu searchable-select-portal-menu" style={menuStyle}>
          <div className="searchable-select-search">
            <FiSearch size={14} />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
          </div>
          <div className="searchable-select-options">
            {filtered.map((option) => (
              <button
                type="button"
                key={option.value}
                className={"searchable-select-option" + (String(option.value) === String(value) ? " selected" : "")}
                onClick={() => {
                  onChange?.(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {String(option.value) === String(value) && <FiCheck size={14} />}
              </button>
            ))}
            {!filtered.length && <div className="searchable-select-empty">No matching options</div>}
          </div>
        </div>,
        document.body
      )}

      {error && <div className="common-field-error">{error}</div>}
    </div>
  );
}

export default SearchableSelect;
