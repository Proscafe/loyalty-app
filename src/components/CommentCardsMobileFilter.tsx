"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type DateFilter = "today" | "yesterday" | "week" | "month" | "all";

type FilterItem = {
  key: DateFilter;
  label: string;
};

type CommentCardsMobileFilterProps = {
  filters: FilterItem[];
  activeFilter: DateFilter;
  activeFilterLabel: string;
  search: string;
};

function makeQueryHref(filter: DateFilter, search: string) {
  const params = new URLSearchParams();
  params.set("filter", filter);

  if (search.trim()) {
    params.set("q", search.trim());
  }

  return `/admin/comment-cards?${params.toString()}`;
}

export function CommentCardsMobileFilter({
  filters,
  activeFilter,
  activeFilterLabel,
  search,
}: CommentCardsMobileFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (!isOpen) return;

      const target = event.target as Node;

      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-12 w-full items-center justify-between rounded-full bg-[#FFD66B] px-5 text-[12px] font-black uppercase tracking-[0.12em] text-[#61716b] shadow-[0_12px_26px_rgba(255,214,107,0.22)]"
        aria-expanded={isOpen}
        aria-label="Open comment card filters"
      >
        <span>Filter</span>
        <span>{activeFilterLabel}</span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[58px] z-30 rounded-[24px] bg-[#718078] p-3 shadow-[0_22px_46px_rgba(20,30,26,0.26)]">
          <div className="grid gap-2">
            {filters.map((filter) => {
              const isActive = filter.key === activeFilter;

              return (
                <Link
                  key={filter.key}
                  href={makeQueryHref(filter.key, search)}
                  onClick={() => setIsOpen(false)}
                  className={`flex h-11 items-center justify-between rounded-full px-4 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                    isActive
                      ? "bg-[#FFD66B] text-[#61716b]"
                      : "bg-white/12 text-white hover:bg-white/18"
                  }`}
                >
                  <span>{filter.label}</span>
                  {isActive ? <span>✓</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CommentCardsMobileFilter;
