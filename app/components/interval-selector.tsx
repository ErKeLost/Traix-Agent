"use client";

import { startTransition } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { INTERVALS } from "@/lib/market";

type IntervalSelectorProps = {
  interval: (typeof INTERVALS)[number];
  onIntervalChange: (interval: (typeof INTERVALS)[number]) => void;
};

export function IntervalSelector({ interval, onIntervalChange }: IntervalSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={interval}
      onValueChange={(value) => {
        if (!value) {
          return;
        }

        startTransition(() => {
          onIntervalChange(value as (typeof INTERVALS)[number]);
        });
      }}
      size="sm"
      variant="default"
      spacing={0}
      className="flex items-center"
    >
      {INTERVALS.map((item) => (
        <ToggleGroupItem
          key={item}
          value={item}
          className="h-7 min-w-0 px-2.5 text-[11px] font-medium tracking-[0.04em] text-slate-400 data-[state=on]:bg-[#2a333f] data-[state=on]:text-[#f2ede4] hover:bg-white/6 hover:text-white"
        >
          {item}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
