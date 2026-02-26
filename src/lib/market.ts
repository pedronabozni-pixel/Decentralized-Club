export async function getMarketSnapshot() {
  const base = process.env.COINGECKO_API_BASE ?? "https://api.coingecko.com/api/v3";

  const response = await fetch(
    `${base}/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true`,
    { next: { revalidate: 120 } }
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

type CmcIndicators = {
  fearGreed: number | null;
  altcoinSeason: number | null;
  averageCryptoRsi: number | null;
};

function pickNumericValue(input: unknown): number | null {
  if (!input || typeof input !== "object") return null;

  if (Array.isArray(input)) {
    for (const item of input) {
      const fromItem = pickNumericValue(item);
      if (fromItem !== null) return fromItem;
    }
    return null;
  }

  const obj = input as Record<string, unknown>;
  const directCandidates = ["value", "score", "index", "altcoin_season_index", "fear_greed_index", "rsi"];

  for (const key of directCandidates) {
    const raw = obj[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  }

  const nestedCandidates = ["data", "result", "latest", "items"];
  for (const key of nestedCandidates) {
    const fromNested = pickNumericValue(obj[key]);
    if (fromNested !== null) return fromNested;
  }

  return null;
}

async function fetchCmc(paths: string[]) {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) return null;

  const base = process.env.CMC_API_BASE ?? "https://pro-api.coinmarketcap.com";

  for (const path of paths) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: {
          Accept: "application/json",
          "X-CMC_PRO_API_KEY": apiKey
        },
        next: { revalidate: 300 }
      });

      if (!response.ok) continue;
      return response.json();
    } catch {
      continue;
    }
  }

  return null;
}

function extractCloses(payload: unknown): number[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return [];

  for (const asset of Object.values(data)) {
    if (!asset || typeof asset !== "object") continue;
    const quotes = (asset as { quotes?: unknown }).quotes;
    if (!Array.isArray(quotes)) continue;

    const closes = quotes
      .map((q) => {
        if (!q || typeof q !== "object") return null;
        const usd = (q as { quote?: { USD?: { close?: number } } }).quote?.USD;
        return typeof usd?.close === "number" ? usd.close : null;
      })
      .filter((v): v is number => v !== null);

    if (closes.length > 0) return closes;
  }

  return [];
}

function calculateRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export async function getCmcIndicators(): Promise<CmcIndicators> {
  const fearGreedPayloadPromise = fetchCmc([
    "/v3/fear-and-greed/historical?limit=1",
    "/v3/fear-and-greed/latest"
  ]);
  const altcoinSeasonPayloadPromise = fetchCmc([
    "/v1/altcoin-season/historical?limit=1",
    "/v1/altcoin-season/latest",
    "/v1/altcoin-season-index/historical?limit=1",
    "/v1/altcoin-season-index/latest"
  ]);

  const ids = [1, 1027, 1839, 5426];
  const ohlcvPromises = ids.map((id) =>
    fetchCmc([`/v2/cryptocurrency/ohlcv/historical?id=${id}&time_period=daily&count=40&convert=USD`])
  );

  const [fearGreedPayload, altcoinSeasonPayload, ...ohlcvPayloads] = await Promise.all([
    fearGreedPayloadPromise,
    altcoinSeasonPayloadPromise,
    ...ohlcvPromises
  ]);

  const fearGreed = pickNumericValue(fearGreedPayload);
  const altcoinSeason = pickNumericValue(altcoinSeasonPayload);

  const rsiValues = ohlcvPayloads
    .map((payload) => calculateRsi(extractCloses(payload), 14))
    .filter((value): value is number => value !== null);

  const averageCryptoRsi =
    rsiValues.length > 0 ? rsiValues.reduce((sum, value) => sum + value, 0) / rsiValues.length : null;

  return {
    fearGreed,
    altcoinSeason,
    averageCryptoRsi
  };
}
