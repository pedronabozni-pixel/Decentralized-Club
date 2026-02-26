import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";

export default async function AdminMetricsPage() {
  const [activeMembers, activeSubs, canceledCount, topContent] = await Promise.all([
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: true } }),
    db.subscription.count({ where: { status: "CANCELED" } }),
    db.contentView.groupBy({
      by: ["contentType", "contentId"],
      _count: { _all: true },
      orderBy: { _count: { contentId: "desc" } },
      take: 10
    })
  ]);

  const monthlyRevenue = activeSubs.reduce((sum, item) => sum + item.plan.priceCents, 0);
  const churnRate = activeMembers + canceledCount === 0 ? 0 : (canceledCount / (activeMembers + canceledCount)) * 100;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Métricas</h1>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-muted">Membros ativos</p>
          <p className="text-2xl font-semibold">{activeMembers}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Receita mensal estimada</p>
          <p className="text-2xl font-semibold">{formatMoney(monthlyRevenue)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Taxa de cancelamento</p>
          <p className="text-2xl font-semibold">{churnRate.toFixed(2)}%</p>
        </div>
      </div>

      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">Conteúdo mais acessado</h2>
        <ul className="space-y-1 text-sm">
          {topContent.map((item) => (
            <li key={`${item.contentType}-${item.contentId}`}>
              {item.contentType} / {item.contentId} - {item._count._all} acessos
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
