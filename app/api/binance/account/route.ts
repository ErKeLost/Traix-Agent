import { fetchBinanceAccountSnapshot } from "@/lib/binance-private";

export async function GET() {
  try {
    const payload = await fetchBinanceAccountSnapshot();
    return Response.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Binance account data.";

    return Response.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
