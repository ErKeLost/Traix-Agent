## Trading Terminal

Binance public market data terminal built with Next.js 16 and `lightweight-charts`.

## Environment

Public market data does not require a Binance API key.

If you later want to add private account data or order placement, create a local env file:

```bash
cp .env.example .env.local
```

Then fill in:

```bash
BINANCE_API_KEY=your_api_key
BINANCE_SECRET_KEY=your_secret_key
```

Keep `BINANCE_SECRET_KEY` on the server only. Do not expose it to client-side code.

## Getting Started

First, run the development server with Bun:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This app currently uses Binance public REST and WebSocket market data only.

## Binance API key

You only need a key for:

- account balances
- open orders
- trade history
- order placement and cancellation

Create it from your Binance account's `API Management` page, then put it in `.env.local`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
