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
        "min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#0b1117_0%,#0a1015_54%,#090d12_100%)] px-3 py-3",
        className,
      )}
      {...props}
    >
      <div className="flex min-h-full flex-col justify-end gap-4">{children}</div>
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
        "flex min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      {icon ? <div className="mb-4 text-[#8b7143]">{icon}</div> : null}
      <h3 className="max-w-xl text-balance text-[clamp(1.25rem,2vw,1.9rem)] font-semibold tracking-[-0.05em] text-[#f3eee5]">
        {title}
      </h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
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
        "absolute right-4 bottom-4 z-10 rounded-full border-white/10 bg-[#121922]/95 text-slate-300 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur hover:bg-[#18202a] hover:text-slate-100",
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
