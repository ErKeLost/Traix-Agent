"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MessageContextValue = {
  from: "user" | "assistant" | "system"
}

const MessageContext = React.createContext<MessageContextValue | null>(null)

function useMessageContext() {
  const context = React.useContext(MessageContext)

  if (!context) {
    throw new Error("Message components must be used within Message")
  }

  return context
}

function Message({ from, className, children, ...props }: React.ComponentProps<"div"> & { from: "user" | "assistant" | "system" }) {
  return (
    <MessageContext.Provider value={{ from }}>
      <div
        className={cn(
          "group/message flex w-full flex-col gap-2",
          from === "user" ? "items-end" : "items-start",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </MessageContext.Provider>
  )
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  const { from } = useMessageContext()

  return (
    <div
      className={cn(
        "w-full max-w-[92%] px-3 py-3",
        from === "user"
          ? "rounded-2xl rounded-br-md border border-[#8b7143]/25 bg-[#192230] text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:ml-10"
          : "text-slate-100 sm:mr-10",
        className,
      )}
      {...props}
    />
  )
}

function MessageResponse({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("whitespace-pre-wrap break-words text-sm leading-6", className)} {...props} />
}

function MessageActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />
}

function MessageAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button type="button" variant="ghost" size="icon-xs" className={cn("text-slate-500 hover:text-slate-200", className)} {...props} />
}

export { Message, MessageAction, MessageActions, MessageContent, MessageResponse }