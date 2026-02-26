import { NextResponse } from "next/server";

const IDS = "bitcoin,ethereum,solana,binancecoin";

export async function GET() {
  const base = process.env.COINGECKO_API_BASE ?? "https://api.coingecko.com/api/v3";

  const response = await fetch(`${base}/simple/price?ids=${IDS}&vs_currencies=usd&include_24hr_change=true`, {
    next: { revalidate: 120 }
  });

  if (!response.ok) {
    return NextResponse.json({ error: "market_unavailable" }, { status: 503 });
  }

  const data = await response.json();
  return NextResponse.json(data);
}
