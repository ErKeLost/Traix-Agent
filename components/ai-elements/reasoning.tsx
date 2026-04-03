"use client"

import * as React from "react"
import { ChevronDownIcon, SparklesIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type ReasoningContextValue = {
  isStreaming: boolean
  isOpen: boolean
}

const ReasoningContext = React.createContext<ReasoningContextValue | null>(null)

function useReasoningContext() {
  const context = React.useContext(ReasoningContext)

  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning")
  }

  return context
}

function Reasoning({
  className,
  isStreaming = false,
  defaultOpen = true,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  React.useEffect(() => {
    if (isStreaming) {
      setOpen(true)
      return
    }

    setOpen(false)
  }, [isStreaming])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      onOpenChange?.(nextOpen)
    },
    [onOpenChange],
  )

  return (
    <ReasoningContext.Provider value={{ isStreaming, isOpen: open }}>
      <Collapsible open={open} onOpenChange={handleOpenChange} className={cn("w-full border-l border-white/8 pl-3", className)} {...props}>
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  )
}

function ReasoningTrigger({ className, ...props }: React.ComponentProps<typeof CollapsibleTrigger>) {
  const { isStreaming, isOpen } = useReasoningContext()

  return (
    <CollapsibleTrigger
      className={cn("flex w-full items-center justify-between gap-2 py-1.5 text-left text-xs uppercase tracking-[0.18em] text-slate-500", className)}
      {...props}
    >
      <span className="flex items-center gap-2">
        <SparklesIcon className={cn("size-3.5", isStreaming ? "text-[#c9a05e]" : "text-slate-500")} />
        {isStreaming ? "Thinking" : "Model trace"}
      </span>
      <ChevronDownIcon className={cn("size-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
    </CollapsibleTrigger>
  )
}

function ReasoningContent({ className, ...props }: React.ComponentProps<typeof CollapsibleContent>) {
  return <CollapsibleContent className={cn("py-2 text-sm leading-6 text-slate-400", className)} {...props} />
}

export { Reasoning, ReasoningContent, ReasoningTrigger }