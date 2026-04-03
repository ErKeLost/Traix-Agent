"use client"

import * as React from "react"
import { ArrowUpIcon, SquareIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PromptInputMessage = {
  text: string
  files?: File[]
}

function PromptInputProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function PromptInput({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      className={cn(
        "rounded-[22px] border border-[#8b7143]/40 bg-[linear-gradient(180deg,#171d27_0%,#111821_100%)] p-2 shadow-[0_18px_48px_rgba(0,0,0,0.28)]",
        className,
      )}
      {...props}
    />
  )
}

function PromptInputBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0", className)} {...props} />
}

function PromptInputFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-1 flex items-center justify-between gap-3 px-2 pb-1", className)} {...props} />
}

function PromptInputTools({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-1.5", className)} {...props} />
}

function PromptInputButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "rounded-full border border-transparent px-3 text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-100",
        className,
      )}
      {...props}
    />
  )
}

function PromptInputTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      className={cn(
        "min-h-[108px] resize-none border-0 bg-transparent px-4 py-4 text-[15px] leading-7 text-slate-100 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  )
}

function PromptInputSubmit({
  className,
  status = "ready",
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  status?: "submitted" | "streaming" | "ready" | "error"
}) {
  const isStreaming = status === "submitted" || status === "streaming"

  return (
    <Button
      type="submit"
      size="icon"
      className={cn(
        "size-10 rounded-2xl bg-[#c9a05e] text-[#11161d] shadow-[0_8px_24px_rgba(201,160,94,0.28)] hover:bg-[#d3ab6d]",
        className,
      )}
      {...props}
    >
      {children ?? (isStreaming ? <Spinner className="size-4" /> : <ArrowUpIcon className="size-4" />)}
    </Button>
  )
}

function PromptInputStop({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("rounded-full border-white/10 bg-transparent px-3 text-slate-300", className)}
      {...props}
    >
      <SquareIcon className="size-3.5 fill-current" />
    </Button>
  )
}

export {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputStop,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
}