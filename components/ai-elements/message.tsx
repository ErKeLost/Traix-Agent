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
          "group/message flex w-full flex-col gap-1.5",
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
        "w-full px-3 py-3",
        from === "user"
          ? "max-w-[78%] rounded-[20px] rounded-br-md border border-[#8b7143]/24 bg-[linear-gradient(180deg,#18212b_0%,#131a23_100%)] text-slate-100 shadow-[0_14px_28px_rgba(0,0,0,0.14)] sm:ml-20"
          : "max-w-[96%] rounded-[22px] border border-white/7 bg-[linear-gradient(180deg,rgba(19,26,33,0.9)_0%,rgba(12,17,23,0.92)_100%)] px-4 py-3.5 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:mr-10",
        className,
      )}
      {...props}
    />
  )
}

function MessageResponse({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("whitespace-pre-wrap break-words text-[14px] leading-6 text-[color:color-mix(in_oklab,#eef2f7_88%,#8fa0b4)]", className)} {...props} />
}

function MessageActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-1 pl-2", className)} {...props} />
}

function MessageAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button type="button" variant="ghost" size="icon-xs" className={cn("text-slate-500 hover:bg-white/[0.04] hover:text-slate-200", className)} {...props} />
}

export { Message, MessageAction, MessageActions, MessageContent, MessageResponse }