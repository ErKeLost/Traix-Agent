import { createHmac } from "node:crypto";

type BinanceAccountResponse = {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  accountType: string;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  permissions?: string[];
};

type BinanceOpenOrder = {
  symbol: string;
  side: string;
  type: string;
  origQty: string;
  price: string;
  status: string;
  updateTime: number;
};

export type BinanceAccountSnapshot = {
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  permissions: string[];
  commissions: {
    maker: number;
    taker: number;
    buyer: number;
    seller: number;
  };
  balances: Array<{
    asset: string;
    free: number;
    locked: number;
    total: number;
  }>;
  openOrders: Array<{
    symbol: string;
    side: string;
    type: string;
    quantity: number;
    price: number;
    status: string;
    updateTime: number;
  }>;
};

const BINANCE_API_BASE = "https://api.binance.com";

export async function fetchBinanceAccountSnapshot() {
  const [account, openOrders] = await Promise.all([
    signedBinanceRequest<BinanceAccountResponse>("/api/v3/account"),
    signedBinanceRequest<BinanceOpenOrder[]>("/api/v3/openOrders"),
  ]);

  const balances = account.balances
    .map((balance) => {
      const free = Number(balance.free);
      const locked = Number(balance.locked);

      return {
        asset: balance.asset,
        free,
        locked,
        total: free + locked,
      };
    })
    .filter((balance) => balance.total > 0)
    .sort((left, right) => right.total - left.total)
    .slice(0, 12);

  return {
    accountType: account.accountType,
    canTrade: account.canTrade,
    canWithdraw: account.canWithdraw,
    canDeposit: account.canDeposit,
    permissions: account.permissions ?? [],
    commissions: {
      maker: account.makerCommission,
      taker: account.takerCommission,
      buyer: account.buyerCommission,
      seller: account.sellerCommission,
    },
    balances,
    openOrders: openOrders.slice(0, 12).map((order) => ({
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: Number(order.origQty),
      price: Number(order.price),
      status: order.status,
      updateTime: order.updateTime,
    })),
  } satisfies BinanceAccountSnapshot;
}

function getCredentials() {
  const apiKey = process.env.BINANCE_API_KEY;
  const secretKey = process.env.BINANCE_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("Missing Binance API credentials.");
  }

  return { apiKey, secretKey };
}

async function signedBinanceRequest<T>(path: string) {
  const { apiKey, secretKey } = getCredentials();

  const query = new URLSearchParams({
    timestamp: String(Date.now()),
    recvWindow: "5000",
  });

  const signature = createHmac("sha256", secretKey)
    .update(query.toString())
    .digest("hex");

  query.set("signature", signature);

  const response = await fetch(`${BINANCE_API_BASE}${path}?${query.toString()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-MBX-APIKEY": apiKey,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Binance private request failed: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as T;
}
