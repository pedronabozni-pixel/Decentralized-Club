import { unstable_cache } from "next/cache";

async function getMarketSnapshotUncached() {
  const base = process.env.COINGECKO_API_BASE ?? "https://api.coingecko.com/api/v3";

  try {
    const response = await fetch(
      `${base}/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          Accept: "application/json"
        },
        next: { revalidate: 120 }
      }
    );

    if (response.ok) {
      return response.json();
    }
  } catch {
    // Fallback below.
  }

  const apiKey = process.env.CMC_API_KEY;
  const cmcBase = process.env.CMC_API_BASE ?? "https://pro-api.coinmarketcap.com";
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `${cmcBase}/v2/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL,BNB&convert=USD`,
      {
        headers: {
          Accept: "application/json",
          "X-CMC_PRO_API_KEY": apiKey
        },
        next: { revalidate: 120 }
      }
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: Record<
        string,
        Array<{
          quote?: {
            USD?: {
              price?: number;
              percent_change_24h?: number;
            };
          };
        }>
      >;
    };

    const btc = payload.data?.BTC?.[0]?.quote?.USD;
    const eth = payload.data?.ETH?.[0]?.quote?.USD;
    const sol = payload.data?.SOL?.[0]?.quote?.USD;
    const bnb = payload.data?.BNB?.[0]?.quote?.USD;

    if (!btc && !eth && !sol && !bnb) return null;

    return {
      bitcoin: {
        usd: btc?.price,
        usd_24h_change: btc?.percent_change_24h
      },
      ethereum: {
        usd: eth?.price,
        usd_24h_change: eth?.percent_change_24h
      },
      solana: {
        usd: sol?.price,
        usd_24h_change: sol?.percent_change_24h
      },
      binancecoin: {
        usd: bnb?.price,
        usd_24h_change: bnb?.percent_change_24h
      }
    };
  } catch {
    return null;
  }
}

export type TopCoinForTv = {
  id: string;
  name: string;
  symbol: string;
  tvSymbol: string;
};

const tvSymbolOverrides: Record<string, string> = {
  bitcoin: "BINANCE:BTCUSDT",
  ethereum: "BINANCE:ETHUSDT",
  solana: "BINANCE:SOLUSDT",
  binancecoin: "BINANCE:BNBUSDT"
};

const fallbackTopCoins: TopCoinForTv[] = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", tvSymbol: "BINANCE:BTCUSDT" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", tvSymbol: "BINANCE:ETHUSDT" },
  { id: "xrp", name: "XRP", symbol: "XRP", tvSymbol: "BINANCE:XRPUSDT" },
  { id: "bnb", name: "BNB", symbol: "BNB", tvSymbol: "BINANCE:BNBUSDT" },
  { id: "solana", name: "Solana", symbol: "SOL", tvSymbol: "BINANCE:SOLUSDT" },
  { id: "stacks", name: "Stacks", symbol: "STX", tvSymbol: "BINANCE:STXUSDT" },
  { id: "multiversx", name: "MultiversX", symbol: "EGLD", tvSymbol: "BINANCE:EGLDUSDT" },
  { id: "dogecoin", name: "Dogecoin", symbol: "DOGE", tvSymbol: "BINANCE:DOGEUSDT" },
  { id: "cardano", name: "Cardano", symbol: "ADA", tvSymbol: "BINANCE:ADAUSDT" },
  { id: "tron", name: "TRON", symbol: "TRX", tvSymbol: "BINANCE:TRXUSDT" },
  { id: "chainlink", name: "Chainlink", symbol: "LINK", tvSymbol: "BINANCE:LINKUSDT" },
  { id: "avalanche-2", name: "Avalanche", symbol: "AVAX", tvSymbol: "BINANCE:AVAXUSDT" },
  { id: "stellar", name: "Stellar", symbol: "XLM", tvSymbol: "BINANCE:XLMUSDT" },
  { id: "toncoin", name: "Toncoin", symbol: "TON", tvSymbol: "BINANCE:TONUSDT" },
  { id: "sui", name: "Sui", symbol: "SUI", tvSymbol: "BINANCE:SUIUSDT" },
  { id: "shiba-inu", name: "Shiba Inu", symbol: "SHIB", tvSymbol: "BINANCE:SHIBUSDT" },
  { id: "polkadot", name: "Polkadot", symbol: "DOT", tvSymbol: "BINANCE:DOTUSDT" },
  { id: "bitcoin-cash", name: "Bitcoin Cash", symbol: "BCH", tvSymbol: "BINANCE:BCHUSDT" },
  { id: "near", name: "NEAR", symbol: "NEAR", tvSymbol: "BINANCE:NEARUSDT" },
  { id: "litecoin", name: "Litecoin", symbol: "LTC", tvSymbol: "BINANCE:LTCUSDT" },
  { id: "aptos", name: "Aptos", symbol: "APT", tvSymbol: "BINANCE:APTUSDT" },
  { id: "internet-computer", name: "Internet Computer", symbol: "ICP", tvSymbol: "BINANCE:ICPUSDT" },
  { id: "uniswap", name: "Uniswap", symbol: "UNI", tvSymbol: "BINANCE:UNIUSDT" },
  { id: "ethereum-classic", name: "Ethereum Classic", symbol: "ETC", tvSymbol: "BINANCE:ETCUSDT" },
  { id: "render-token", name: "Render", symbol: "RNDR", tvSymbol: "BINANCE:RNDRUSDT" },
  { id: "injective-protocol", name: "Injective", symbol: "INJ", tvSymbol: "BINANCE:INJUSDT" },
  { id: "cosmos", name: "Cosmos", symbol: "ATOM", tvSymbol: "BINANCE:ATOMUSDT" },
  { id: "arbitrum", name: "Arbitrum", symbol: "ARB", tvSymbol: "BINANCE:ARBUSDT" },
  { id: "optimism", name: "Optimism", symbol: "OP", tvSymbol: "BINANCE:OPUSDT" },
  { id: "filecoin", name: "Filecoin", symbol: "FIL", tvSymbol: "BINANCE:FILUSDT" },
  { id: "vechain", name: "VeChain", symbol: "VET", tvSymbol: "BINANCE:VETUSDT" },
  { id: "maker", name: "Maker", symbol: "MKR", tvSymbol: "BINANCE:MKRUSDT" },
  { id: "aave", name: "Aave", symbol: "AAVE", tvSymbol: "BINANCE:AAVEUSDT" },
  { id: "sei-network", name: "Sei", symbol: "SEI", tvSymbol: "BINANCE:SEIUSDT" },
  { id: "kaspa", name: "Kaspa", symbol: "KAS", tvSymbol: "BINANCE:KASUSDT" },
  { id: "the-graph", name: "The Graph", symbol: "GRT", tvSymbol: "BINANCE:GRTUSDT" },
  { id: "algorand", name: "Algorand", symbol: "ALGO", tvSymbol: "BINANCE:ALGOUSDT" },
  { id: "immutable-x", name: "Immutable", symbol: "IMX", tvSymbol: "BINANCE:IMXUSDT" },
  { id: "mantle", name: "Mantle", symbol: "MNT", tvSymbol: "BINANCE:MNTUSDT" },
  { id: "lido-dao", name: "Lido DAO", symbol: "LDO", tvSymbol: "BINANCE:LDOUSDT" },
  { id: "thorchain", name: "THORChain", symbol: "RUNE", tvSymbol: "BINANCE:RUNEUSDT" },
  { id: "eos", name: "EOS", symbol: "EOS", tvSymbol: "BINANCE:EOSUSDT" },
  { id: "pyth-network", name: "Pyth", symbol: "PYTH", tvSymbol: "BINANCE:PYTHUSDT" },
  { id: "pepe", name: "Pepe", symbol: "PEPE", tvSymbol: "BINANCE:PEPEUSDT" },
  { id: "celestia", name: "Celestia", symbol: "TIA", tvSymbol: "BINANCE:TIAUSDT" },
  { id: "flow", name: "Flow", symbol: "FLOW", tvSymbol: "BINANCE:FLOWUSDT" },
  { id: "axie-infinity", name: "Axie Infinity", symbol: "AXS", tvSymbol: "BINANCE:AXSUSDT" },
  { id: "gala", name: "Gala", symbol: "GALA", tvSymbol: "BINANCE:GALAUSDT" },
  { id: "sandbox", name: "The Sandbox", symbol: "SAND", tvSymbol: "BINANCE:SANDUSDT" },
  { id: "decentraland", name: "Decentraland", symbol: "MANA", tvSymbol: "BINANCE:MANAUSDT" }
];

async function getTopCoinsForTradingViewUncached(): Promise<TopCoinForTv[]> {
  const base = process.env.COINGECKO_API_BASE ?? "https://api.coingecko.com/api/v3";
  try {
    const coinsResponse = await fetch(
      `${base}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`,
      { next: { revalidate: 300 } }
    );

    if (!coinsResponse.ok) return fallbackTopCoins;

    const rows = (await coinsResponse.json()) as Array<{ id: string; name: string; symbol: string }>;

    const seen = new Set<string>();
    const filtered = rows
      .map((row) => {
        const upper = row.symbol.toUpperCase();
        const override = tvSymbolOverrides[row.id];
        const tvSymbol = override ?? `BINANCE:${upper}USDT`;
        return {
          id: row.id,
          name: row.name,
          symbol: upper,
          tvSymbol
        };
      })
      .filter((item) => {
        if (seen.has(item.tvSymbol)) return false;
        seen.add(item.tvSymbol);
        return true;
      })
      .slice(0, 50);

    return filtered.length >= 50 ? filtered : fallbackTopCoins;
  } catch {
    return fallbackTopCoins;
  }
}

type CmcIndicators = {
  fearGreed: number | null;
  fearGreedSeries: number[];
  altcoinSeason: number | null;
  altcoinSeasonSeries: number[];
  averageCryptoRsi: number | null;
  averageCryptoRsiSeries: number[];
};

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
        next: { revalidate: 60 }
      });

      if (!response.ok) continue;
      return response.json();
    } catch {
      continue;
    }
  }

  return null;
}

type CmcPageSnapshot = {
  fearGreed: number | null;
  altcoinSeason: number | null;
};

function parseNumberFromMatch(match: RegExpMatchArray | null): number | null {
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

async function fetchCmcPageSnapshot(): Promise<CmcPageSnapshot> {
  try {
    const response = await fetch("https://coinmarketcap.com/charts/altcoin-season-index/", {
      next: { revalidate: 60 }
    });
    if (!response.ok) return { fearGreed: null, altcoinSeason: null };

    const html = await response.text();

    // Source of truth rendered on CMC page itself.
    const fearGreed = parseNumberFromMatch(
      html.match(/"fearGreedIndexData"\s*:\s*\{\s*"currentIndex"\s*:\s*\{\s*"score"\s*:\s*([0-9]+(?:\.[0-9]+)?)/)
    );
    const altcoinSeason = parseNumberFromMatch(html.match(/"altcoinIndex"\s*:\s*([0-9]+(?:\.[0-9]+)?)/));

    return { fearGreed, altcoinSeason };
  } catch {
    return { fearGreed: null, altcoinSeason: null };
  }
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

function calculateRsiSeries(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  const values: number[] = [];

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    if (Number.isFinite(rsi)) values.push(rsi);
  }

  return values;
}

async function fetchCmcPublicChartCloses(id: number): Promise<number[]> {
  try {
    const response = await fetch(
      `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail/chart?id=${id}&range=3M`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) return [];

    const payload = (await response.json()) as {
      data?: {
        points?: Record<string, { v?: number[] }>;
      };
    };

    const points = payload.data?.points;
    if (!points) return [];

    const entries = Object.entries(points).sort((a, b) => Number(a[0]) - Number(b[0]));
    const daily = new Map<string, number>();

    for (const [timestamp, point] of entries) {
      const close = point.v?.[0];
      if (typeof close !== "number" || !Number.isFinite(close)) continue;

      const dayKey = new Date(Number(timestamp) * 1000).toISOString().slice(0, 10);
      daily.set(dayKey, close);
    }

    return [...daily.values()];
  } catch {
    return [];
  }
}

async function fetchAltcoinSeasonFromPage(): Promise<number | null> {
  try {
    const response = await fetch("https://coinmarketcap.com/charts/altcoin-season-index/", {
      next: { revalidate: 300 }
    });
    if (!response.ok) return null;

    const html = await response.text();
    const match = html.match(/"altcoinIndex":\s*([0-9]+(?:\.[0-9]+)?)/);
    if (!match) return null;

    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function getCmcIndicatorsUncached(): Promise<CmcIndicators> {
  const [pageSnapshot, fearGreedLatest, fearGreedHistorical, altcoinSeasonFromPage, ...charts] = await Promise.all([
    fetchCmcPageSnapshot(),
    fetchCmc(["/v3/fear-and-greed/latest"]),
    fetchCmc(["/v3/fear-and-greed/historical?limit=30"]),
    fetchAltcoinSeasonFromPage(),
    fetchCmcPublicChartCloses(1),
    fetchCmcPublicChartCloses(1027),
    fetchCmcPublicChartCloses(1839),
    fetchCmcPublicChartCloses(5426)
  ]);

  const fearGreedFromApi =
    typeof (fearGreedLatest as { data?: { value?: unknown } } | null)?.data?.value === "number"
      ? ((fearGreedLatest as { data: { value: number } }).data.value ?? null)
      : null;

  const fearGreed = pageSnapshot.fearGreed ?? fearGreedFromApi;

  const fearGreedSeries = Array.isArray((fearGreedHistorical as { data?: unknown[] } | null)?.data)
    ? ((fearGreedHistorical as { data: Array<{ value?: number }> }).data
        .map((item) => (typeof item.value === "number" ? item.value : null))
        .filter((value): value is number => value !== null)
        .reverse())
    : [];

  const altcoinSeason = pageSnapshot.altcoinSeason ?? altcoinSeasonFromPage;
  const altcoinSeasonSeries = altcoinSeason !== null ? [0, 25, 50, 75, altcoinSeason, 100] : [];

  const rsiSeriesByAsset = charts.map((closes) => calculateRsiSeries(closes, 14)).filter((series) => series.length > 0);
  const minLen = rsiSeriesByAsset.reduce((min, series) => Math.min(min, series.length), Number.POSITIVE_INFINITY);

  const averageCryptoRsiSeries =
    minLen === Number.POSITIVE_INFINITY
      ? []
      : Array.from({ length: minLen }, (_, idx) => {
          const sliceValues = rsiSeriesByAsset.map((series) => series[series.length - minLen + idx]);
          return sliceValues.reduce((sum, value) => sum + value, 0) / sliceValues.length;
        });

  const rsiValues = charts
    .map((closes) => calculateRsi(closes, 14))
    .filter((value): value is number => value !== null);

  const averageCryptoRsi =
    rsiValues.length > 0 ? rsiValues.reduce((sum, value) => sum + value, 0) / rsiValues.length : null;

  return {
    fearGreed,
    fearGreedSeries,
    altcoinSeason,
    altcoinSeasonSeries,
    averageCryptoRsi,
    averageCryptoRsiSeries
  };
}

const getMarketSnapshotCached = unstable_cache(getMarketSnapshotUncached, ["market-snapshot"], {
  revalidate: 120,
  tags: ["market-snapshot"]
});

const getTopCoinsForTradingViewCached = unstable_cache(getTopCoinsForTradingViewUncached, ["tv-top-coins"], {
  revalidate: 1800,
  tags: ["tv-top-coins"]
});

const getCmcIndicatorsCached = unstable_cache(getCmcIndicatorsUncached, ["cmc-indicators"], {
  revalidate: 300,
  tags: ["cmc-indicators"]
});

export async function getMarketSnapshot() {
  return getMarketSnapshotCached();
}

export async function getTopCoinsForTradingView(): Promise<TopCoinForTv[]> {
  return getTopCoinsForTradingViewCached();
}

export async function getCmcIndicators(): Promise<CmcIndicators> {
  return getCmcIndicatorsCached();
}
