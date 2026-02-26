import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getCmcIndicators, getMarketSnapshot } from "@/lib/market";
import { requireMemberSession } from "@/lib/access";

export default async function DashboardPage() {
  const session = await requireMemberSession();

  const [latestUpdate, latestAnalysis, recentUpdates, subscription, market, cmcIndicators] = await Promise.all([
    db.dailyUpdate.findFirst({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" } }),
    db.analysis.findFirst({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" } }),
    db.dailyUpdate.findMany({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, take: 5 }),
    db.subscription.findUnique({ where: { userId: session.user.id }, include: { plan: true } }),
    getMarketSnapshot(),
    getCmcIndicators()
  ]);

  const assets = [
    { key: "bitcoin", label: "BTC" },
    { key: "ethereum", label: "ETH" },
    { key: "solana", label: "SOL" },
    { key: "binancecoin", label: "BNB" }
  ];
  const cmcConfigured = Boolean(process.env.CMC_API_KEY);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {assets.map((asset) => {
          const row = market?.[asset.key];
          return (
            <div className="card" key={asset.key}>
              <p className="text-sm text-muted">{asset.label}</p>
              <p className="text-xl font-semibold">${row?.usd?.toLocaleString("en-US") ?? "-"}</p>
              <p className={`text-sm ${(row?.usd_24h_change ?? 0) >= 0 ? "text-brand" : "text-danger"}`}>
                {(row?.usd_24h_change ?? 0).toFixed(2)}%
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-muted">Fear & Greed</p>
          <p className="text-2xl font-semibold">
            {cmcIndicators.fearGreed !== null ? cmcIndicators.fearGreed.toFixed(0) : "-"}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Altcoin Season</p>
          <p className="text-2xl font-semibold">
            {cmcIndicators.altcoinSeason !== null ? cmcIndicators.altcoinSeason.toFixed(0) : "-"}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Average Crypto RSI</p>
          <p className="text-2xl font-semibold">
            {cmcIndicators.averageCryptoRsi !== null ? cmcIndicators.averageCryptoRsi.toFixed(2) : "-"}
          </p>
        </div>
      </div>

      {!cmcConfigured ? (
        <div className="card border-yellow-500/40 bg-yellow-500/10 text-sm text-yellow-200">
          Configure <code>CMC_API_KEY</code> no arquivo <code>.env</code> para carregar Fear &amp; Greed, Altcoin
          Season e Average Crypto RSI.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <p className="text-sm text-muted">Última atualização diária</p>
          <h2 className="text-lg font-semibold">{latestUpdate?.title ?? "Sem conteúdo"}</h2>
          <p className="text-sm text-muted">{formatDate(latestUpdate?.publishedAt)}</p>
        </article>

        <article className="card">
          <p className="text-sm text-muted">Última análise exclusiva</p>
          <h2 className="text-lg font-semibold">{latestAnalysis?.title ?? "Sem conteúdo"}</h2>
          <p className="text-sm text-muted">{formatDate(latestAnalysis?.publishedAt)}</p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h3 className="mb-2 text-lg font-semibold">Conteúdos recentes</h3>
          <ul className="space-y-2 text-sm">
            {recentUpdates.map((item) => (
              <li key={item.id}>
                {item.title} <span className="text-muted">({formatDate(item.publishedAt)})</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3 className="mb-2 text-lg font-semibold">Assinatura</h3>
          <p className="text-sm">Plano: {subscription?.plan.name ?? "-"}</p>
          <p className="text-sm">Status: {subscription?.status ?? "-"}</p>
          <p className="text-sm">Próxima cobrança: {formatDate(subscription?.renewalDate)}</p>
        </section>
      </div>
    </div>
  );
}
