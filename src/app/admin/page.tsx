import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";

export default async function AdminHomePage() {
  const [activeMembers, monthlySubs, canceledSubs, topContent] = await Promise.all([
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: true } }),
    db.subscription.count({ where: { status: "CANCELED" } }),
    db.contentView.groupBy({
      by: ["contentType", "contentId"],
      _count: { _all: true },
      orderBy: { _count: { contentId: "desc" } },
      take: 5
    })
  ]);

  const monthlyRevenue = monthlySubs.reduce((sum, item) => sum + item.plan.priceCents, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Painel Administrativo</h1>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-muted">Membros ativos</p>
          <p className="text-2xl font-semibold">{activeMembers}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Receita mensal estimada</p>
          <p className="text-2xl font-semibold">{formatMoney(monthlyRevenue)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Cancelamentos</p>
          <p className="text-2xl font-semibold">{canceledSubs}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Conteúdos mais acessados</p>
          <p className="text-2xl font-semibold">{topContent.length}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Link className="card hover:border-brand" href="/admin/conteudos">
          Gerenciar conteúdos
        </Link>
        <Link className="card hover:border-brand" href="/admin/usuarios">
          Gerenciar usuários
        </Link>
      </div>
    </div>
  );
}
