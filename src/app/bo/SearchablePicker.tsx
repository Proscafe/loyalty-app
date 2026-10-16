"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Option = {
  value: string;
  label: string;
};

type Box = {
  left: number;
  top: number;
  width: number;
};

export function SearchablePicker({
  value,
  options,
  placeholder = "SEARCH...",
  onChange,
  className = "",
}: {
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Always-current copies, so delayed callbacks (blur timer) never use stale values.
  const queryRef = useRef(query);
  queryRef.current = query;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const valueRef = useRef(value);
  valueRef.current = value;
  const aliveRef = useRef(true);
  const lastLabelRef = useRef(selected?.label ?? "");

  useEffect(() => {
    aliveRef.current = true;
    setMounted(true);
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const label = selected?.label ?? "";
    const previous = lastLabelRef.current;
    lastLabelRef.current = label;

    if (label) {
      setQuery(label);
    } else {
      // Only clear the box if it still shows the old selection;
      // never wipe text the user is typing.
      setQuery((current) => (current === previous ? "" : current));
    }
  }, [selected?.label]);

  function positionMenu() {
    const input = inputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();

    setBox({
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;

    positionMenu();

    const update = () => positionMenu();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function close(event: MouseEvent) {
      const target = event.target as Node;

      if (inputRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;

      setOpen(false);
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q || selected?.label === query) return options.slice(0, 100);

    return options
      .filter((option) => option.label.toLowerCase().includes(q))
      .slice(0, 100);
  }, [options, query, selected?.label]);

  function choose(option: Option) {
    queryRef.current = option.label;
    onChangeRef.current(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  function resolveTypedValue(text: string, chooseFirst = false) {
    const q = text.trim().toLowerCase();
    const options = optionsRef.current;
    const onChange = onChangeRef.current;

    if (!q) {
      onChange("");
      return;
    }

    // Already pointing at a matching option: keep it (important when names repeat).
    const current = options.find((option) => option.value === valueRef.current);
    if (current && current.label.trim().toLowerCase() === q) return;

    const exact = options.find(
      (option) => option.label.trim().toLowerCase() === q,
    );

    if (exact) {
      choose(exact);
      return;
    }

    if (chooseFirst) {
      const first = options.find((option) =>
        option.label.toLowerCase().includes(q),
      );

      if (first) {
        choose(first);
        return;
      }
    }

    // Important: typed text that does not resolve to an actual option
    // must not keep an old hidden ID.
    onChange("");
  }

  const menu =
    mounted && open && box
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: box.left,
              top: box.top,
              width: box.width,
              zIndex: 2147483000,
            }}
            className="max-h-[290px] overflow-y-auto rounded-[9px] border border-[#9f9f9f] bg-white shadow-[0_16px_44px_rgba(0,0,0,0.24)]"
          >
            {filtered.length ? (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  className={`block w-full border-b border-black/[0.07] px-3 py-2.5 text-left text-[12px] font-semibold text-black last:border-0 hover:bg-[#eeeeee] ${
                    option.value === value ? "bg-[#eeeeee]" : "bg-white"
                  }`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-[10px] font-bold uppercase text-black/50">
                NO MATCHES
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`relative ${className}`}>
        <input
          ref={inputRef}
          value={query}
          onFocus={() => {
            positionMenu();
            setOpen(true);
          }}
          onClick={() => {
            positionMenu();
            setOpen(true);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            positionMenu();

            // If the user TYPES an exact item name, select it immediately.
            // This is the key save fix: the hidden source ID is now populated.
            const exact = options.find(
              (option) =>
                option.label.trim().toLowerCase() ===
                next.trim().toLowerCase(),
            );

            if (exact) {
              onChange(exact.value);
            } else {
              onChange("");
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();

              const q = query.trim().toLowerCase();
              const exact = options.find(
                (option) => option.label.trim().toLowerCase() === q,
              );
              const first =
                exact ??
                options.find((option) =>
                  option.label.toLowerCase().includes(q),
                );

              if (first) choose(first);
            }

            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => {
            // If the user typed a full name and clicked SAVE without clicking
            // the dropdown result, convert the typed name to its real ID.
            window.setTimeout(() => {
              if (!aliveRef.current) return;
              if (!menuRef.current?.matches(":hover")) {
                resolveTypedValue(queryRef.current, false);
              }
            }, 0);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-[7px] border border-[#9f9f9f] bg-white px-3 py-2.5 text-[11px] font-semibold text-black outline-none focus:border-black"
        />
      </div>

      {menu}
    </>
  );
}
