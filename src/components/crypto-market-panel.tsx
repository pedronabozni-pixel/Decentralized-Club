"use client";

import { useMemo, useState } from "react";
import type { TopCoinForTv } from "@/lib/market";

type MarketRow = {
  usd?: number;
  usd_24h_change?: number;
};

type MarketSnapshot = Record<string, MarketRow | undefined> | null;

type Props = {
  market: MarketSnapshot;
  topCoins: TopCoinForTv[];
};

const assets = [
  { key: "bitcoin", label: "BTC", tvSymbol: "BINANCE:BTCUSDT" },
  { key: "ethereum", label: "ETH", tvSymbol: "BINANCE:ETHUSDT" },
  { key: "solana", label: "SOL", tvSymbol: "BINANCE:SOLUSDT" },
  { key: "binancecoin", label: "BNB", tvSymbol: "BINANCE:BNBUSDT" }
];

function buildTradingViewUrl(symbol: string) {
  const params = new URLSearchParams({
    symbol,
    interval: "240",
    hidesidetoolbar: "1",
    symboledit: "0",
    saveimage: "0",
    toolbarbg: "18181b",
    studies: "[]",
    theme: "dark",
    style: "1",
    timezone: "Etc/UTC",
    withdateranges: "1",
    hideideas: "0",
    enabled_features: "[]",
    disabled_features: "[]",
    utm_source: "decentralized-club",
    utm_medium: "widget"
  });

  return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
}

export function CryptoMarketPanel({ market, topCoins }: Props) {
  const fallbackCoins: TopCoinForTv[] = useMemo(
    () =>
      assets.map((asset) => ({
        id: asset.key,
        name: asset.label,
        symbol: asset.label,
        tvSymbol: asset.tvSymbol
      })),
    []
  );
  const coinOptions = topCoins.length > 0 ? topCoins : fallbackCoins;

  const [selectedTvSymbol, setSelectedTvSymbol] = useState("BINANCE:BTCUSDT");
  const [iframeError, setIframeError] = useState(false);

  const selectedAsset = useMemo(
    () => assets.find((item) => item.tvSymbol === selectedTvSymbol) ?? assets[0],
    [selectedTvSymbol]
  );

  const selectedTopCoin = useMemo(
    () => coinOptions.find((coin) => coin.tvSymbol === selectedTvSymbol) ?? null,
    [coinOptions, selectedTvSymbol]
  );

  const chartUrl = useMemo(() => buildTradingViewUrl(selectedTvSymbol), [selectedTvSymbol]);

  return (
    <section className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {assets.map((asset) => {
          const row = market?.[asset.key];
          const active = selectedTvSymbol === asset.tvSymbol;
          const hasPrice = typeof row?.usd === "number";
          const hasChange = typeof row?.usd_24h_change === "number";

          return (
            <button
              className={`card text-left transition ${active ? "border-brand" : ""}`}
              key={asset.key}
              onClick={() => {
                setSelectedTvSymbol(asset.tvSymbol);
                setIframeError(false);
              }}
              type="button"
            >
              <p className="text-sm text-muted">{asset.label}</p>
              <p className="text-xl font-semibold">{hasPrice ? `$${row.usd!.toLocaleString("en-US")}` : "-"}</p>
              <p className={`text-sm ${!hasChange || row!.usd_24h_change! >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {hasChange ? `${row!.usd_24h_change!.toFixed(2)}%` : "-"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="card">
        <label className="mb-1 block text-sm text-muted">Escolha uma das 50 maiores por capitalização</label>
        <select
          className="input"
          onChange={(e) => {
            setSelectedTvSymbol(e.target.value);
            setIframeError(false);
          }}
          value={selectedTvSymbol}
        >
          {coinOptions.map((coin) => (
            <option key={`${coin.id}-${coin.tvSymbol}`} value={coin.tvSymbol}>
              {coin.name} ({coin.symbol})
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Gráfico {selectedTopCoin?.symbol ?? selectedAsset.label}</h2>
          <p className="text-xs text-muted">Fonte: TradingView</p>
        </div>
        <div className="h-[420px] w-full overflow-hidden rounded-lg border border-border">
          <iframe
            className="h-full w-full"
            key={selectedTvSymbol}
            onError={() => setIframeError(true)}
            src={chartUrl}
            title={`TradingView ${selectedTopCoin?.symbol ?? selectedAsset.label}`}
          />
          {iframeError ? (
            <div className="p-3 text-xs text-muted">Não foi possível carregar o gráfico embutido neste navegador.</div>
          ) : null}
        </div>
        <a
          className="mt-2 inline-block text-xs text-muted underline underline-offset-4"
          href={chartUrl}
          rel="noreferrer"
          target="_blank"
        >
          Abrir gráfico em nova aba
        </a>
      </div>
    </section>
  );
}
