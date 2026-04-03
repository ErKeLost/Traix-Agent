"use client";

import { startTransition } from "react";

import { INTERVALS } from "@/lib/market";

type IntervalSelectorProps = {
  interval: (typeof INTERVALS)[number];
  onIntervalChange: (interval: (typeof INTERVALS)[number]) => void;
};

export function IntervalSelector({ interval, onIntervalChange }: IntervalSelectorProps) {
  return (
    <div className="flex items-center">
      {INTERVALS.map((item) => (
        <button
          key={item}
          type="button"
          className={`h-7 min-w-0 rounded-md px-2.5 text-xs font-medium transition-colors ${
            interval === item
              ? "bg-white/15 text-white"
              : "text-slate-400 hover:bg-white/8 hover:text-white"
          }`}
          onClick={() => {
            startTransition(() => {
              onIntervalChange(item);
            });
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
