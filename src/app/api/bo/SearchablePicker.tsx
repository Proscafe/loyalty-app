"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
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
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(selected?.label ?? "");
  }, [selected?.label]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q || selected?.label === query) return options.slice(0, 80);

    return options
      .filter((option) => option.label.toLowerCase().includes(q))
      .slice(0, 80);
  }, [options, query, selected?.label]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);

          if (!e.target.value) onChange("");
        }}
        placeholder={placeholder}
        className="w-full rounded-[7px] border border-[#9f9f9f] bg-white px-3 py-2.5 text-[11px] font-semibold text-black outline-none focus:border-black"
      />

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] max-h-[260px] overflow-y-auto rounded-[8px] border border-[#bdbdbd] bg-white shadow-xl">
          {filtered.length ? (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setQuery(option.label);
                  setOpen(false);
                }}
                className={`block w-full border-b border-black/[0.06] px-3 py-2.5 text-left text-[11px] font-semibold text-black last:border-0 hover:bg-[#eeeeee] ${
                  option.value === value ? "bg-[#eeeeee]" : ""
                }`}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-[10px] font-bold uppercase text-black/45">
              NO MATCHES
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
