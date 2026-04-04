"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Suggestions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      {...props}
    />
  )
}

function Suggestion({
  className,
  children,
  suggestion,
  ...props
}: React.ComponentProps<"button"> & {
  suggestion?: string
}) {
  return (
    <button
      type="button"
      data-suggestion={suggestion}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3.5 py-2 text-sm text-slate-300 transition-colors hover:border-[#8b7143]/26 hover:bg-[#151d24] hover:text-[#f3eee5]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export { Suggestion, Suggestions }
