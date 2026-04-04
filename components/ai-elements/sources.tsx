"use client"

import * as React from "react"
import { ChevronDownIcon, Link2Icon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type SourcesContextValue = {
  isOpen: boolean
}

const SourcesContext = React.createContext<SourcesContextValue | null>(null)

function useSourcesContext() {
  const context = React.useContext(SourcesContext)

  if (!context) {
    throw new Error("Sources components must be used within Sources")
  }

  return context
}

function Sources({
  className,
  defaultOpen = false,
  children,
  ...props
}: React.ComponentProps<typeof Collapsible>) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <SourcesContext.Provider value={{ isOpen: open }}>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </Collapsible>
    </SourcesContext.Provider>
  )
}

function SourcesTrigger({
  className,
  count,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  count: number
}) {
  const { isOpen } = useSourcesContext()

  return (
    <CollapsibleTrigger
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] text-slate-300 transition-colors hover:border-[#8b7143]/24 hover:bg-[#151d23]",
        className,
      )}
      {...props}
    >
      <Link2Icon className="size-3.5 text-[#c9a05e]" />
      <span>{count} 个参考来源</span>
      <ChevronDownIcon
        className={cn("size-3.5 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
      />
    </CollapsibleTrigger>
  )
}

function SourcesContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      className={cn("mt-3 grid gap-2", className)}
      {...props}
    />
  )
}

function Source({
  className,
  href,
  title,
  ...props
}: React.ComponentProps<"a"> & {
  href: string
  title: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-white/7 bg-[linear-gradient(180deg,rgba(17,23,30,0.88)_0%,rgba(12,17,23,0.92)_100%)] px-3 py-2.5 text-sm text-slate-200 transition-colors hover:border-[#8b7143]/24 hover:bg-[#151d24]",
        className,
      )}
      {...props}
    >
      <span className="line-clamp-2 leading-5">{title}</span>
      <Link2Icon className="size-4 shrink-0 text-slate-500" />
    </a>
  )
}

export { Source, Sources, SourcesContent, SourcesTrigger }
