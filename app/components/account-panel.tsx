"use client";

import { Accordion, Card, Skeleton } from "@heroui/react";

import type { AccountBalance, AccountOrder, BinanceAccountPayload } from "@/lib/market";
import { formatPrice } from "./shared/format";

type AccountPanelProps = {
  account: BinanceAccountPayload | null;
  error: string | null;
};

export function AccountPanel({ account, error }: AccountPanelProps) {
  if (error) {
    return (
      <Card className="panel-surface rounded-lg border shadow-none">
        <Card.Header className="flex-col items-start gap-0 px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Account
          </p>
          <Card.Title className="text-sm font-semibold text-white">
            Binance 只读账户
          </Card.Title>
        </Card.Header>
        <Card.Content className="px-3 pb-3">
          <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
            {error}
          </p>
        </Card.Content>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card className="panel-surface rounded-lg border shadow-none">
        <Card.Header className="flex-col items-start gap-0 px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Account
          </p>
          <Card.Title className="text-sm font-semibold text-white">
            Binance 只读账户
          </Card.Title>
        </Card.Header>
        <Card.Content className="space-y-2 px-3 pb-3">
          <Skeleton className="h-8 rounded bg-white/5" />
          <Skeleton className="h-8 rounded bg-white/5" />
          <Skeleton className="h-16 rounded bg-white/5" />
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card className="panel-surface rounded-lg border shadow-none">
      <Card.Header className="flex-col items-start gap-0 px-3 pt-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Account
        </p>
        <Card.Title className="text-sm font-semibold text-white">
          Binance 只读账户
        </Card.Title>
      </Card.Header>
      <Card.Content className="px-0 pb-0">
        <div className="mt-2 grid grid-cols-2 gap-1.5 px-3">
          <InfoRow label="Type" value={account.accountType} />
          <InfoRow label="Can Trade" value={account.canTrade ? "Yes" : "No"} />
          <InfoRow label="Orders" value={String(account.openOrders.length)} />
          <InfoRow label="Perms" value={account.permissions.join(", ") || "USER_DATA"} />
        </div>

        <Accordion variant="default" hideSeparator className="mt-2">
          <Accordion.Item id="account-details">
            <Accordion.Heading>
              <Accordion.Trigger className="px-3 py-2 text-xs font-semibold text-white">
                Balances & Orders
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="space-y-3 px-3 pb-3">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                    Balances
                  </p>
                  <div className="space-y-1">
                    {account.balances.slice(0, 6).map((b) => (
                      <BalanceRow key={b.asset} balance={b} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                    Open Orders
                  </p>
                  {account.openOrders.length === 0 ? (
                    <p className="rounded-md border border-white/5 px-3 py-2 text-xs text-slate-500">
                      No open orders.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {account.openOrders.slice(0, 4).map((o) => (
                        <OrderRow key={`${o.symbol}-${o.updateTime}`} order={o} />
                      ))}
                    </div>
                  )}
                </div>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Card.Content>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

function BalanceRow({ balance }: { balance: AccountBalance }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-1.5">
      <div>
        <p className="text-xs font-semibold text-white">{balance.asset}</p>
        <p className="text-[10px] text-slate-500">free {balance.free.toFixed(6)}</p>
      </div>
      <p className="text-xs font-mono text-cyan-300">{balance.total.toFixed(6)}</p>
    </div>
  );
}

function OrderRow({ order }: { order: AccountOrder }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white">{order.symbol}</p>
        <p className={`text-[10px] font-semibold ${order.side === "BUY" ? "text-emerald-400" : "text-rose-400"}`}>
          {order.side}
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
        <span>{order.type}</span>
        <span>{order.quantity.toFixed(6)}</span>
        <span>{order.price > 0 ? formatPrice(order.price) : "Market"}</span>
      </div>
    </div>
  );
}
