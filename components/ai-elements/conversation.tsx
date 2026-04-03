"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ConversationContextValue = {
  viewportRef: React.RefObject<HTMLDivElement | null>
  isAtBottom: boolean
  setIsAtBottom: React.Dispatch<React.SetStateAction<boolean>>
  scrollToBottom: (behavior?: ScrollBehavior) => void
}

const ConversationContext = React.createContext<ConversationContextValue | null>(null)

function useConversationContext() {
  const context = React.useContext(ConversationContext)

  if (!context) {
    throw new Error("Conversation components must be used within Conversation")
  }

  return context
}

function Conversation({ className, children, ...props }: React.ComponentProps<"div">) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = React.useState(true)

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    viewport.scrollTo({ top: viewport.scrollHeight, behavior })
  }, [])

  return (
    <ConversationContext.Provider value={{ viewportRef, isAtBottom, setIsAtBottom, scrollToBottom }}>
      <div className={cn("relative flex min-h-0 flex-1 flex-col", className)} {...props}>
        {children}
      </div>
    </ConversationContext.Provider>
  )
}

function ConversationContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { viewportRef, setIsAtBottom, isAtBottom, scrollToBottom } = useConversationContext()

  const handleScroll = React.useCallback(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const nextIsAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 28
    setIsAtBottom(nextIsAtBottom)
  }, [setIsAtBottom, viewportRef])

  React.useEffect(() => {
    if (isAtBottom) {
      scrollToBottom("auto")
    }
  }, [children, isAtBottom, scrollToBottom])

  return (
    <div
      ref={viewportRef}
      onScroll={handleScroll}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto bg-[#0d141b] px-2 py-2",
        className,
      )}
      {...props}
    >
      <div className="flex min-h-full flex-col justify-end gap-3">{children}</div>
    </div>
  )
}

function ConversationEmptyState({
  className,
  icon,
  title,
  description,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      {icon ? <div className="mb-4 text-slate-500">{icon}</div> : null}
      <p className="text-sm font-medium tracking-[-0.02em] text-[#f3eee5]">{title}</p>
      {description ? <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{description}</p> : null}
      {children}
    </div>
  )
}

function ConversationScrollButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { isAtBottom, scrollToBottom } = useConversationContext()

  if (isAtBottom) {
    return null
  }

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="outline"
      className={cn(
        "absolute right-4 bottom-4 z-10 rounded-full border-white/10 bg-[#121922]/95 text-slate-300 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur",
        className,
      )}
      onClick={() => scrollToBottom()}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
      <span className="sr-only">Scroll to latest message</span>
    </Button>
  )
}

export {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
}