import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requireMemberSession } from "@/lib/access";

type Props = {
  searchParams: Promise<{
    q?: string;
    month?: string;
  }>;
};

export default async function UpdatesPage({ searchParams }: Props) {
  await requireMemberSession();
  const params = await searchParams;

  const where = {
    publishedAt: { not: null },
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" as const } },
            { content: { contains: params.q, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const updates = await db.dailyUpdate.findMany({
    where,
    orderBy: { publishedAt: "desc" }
  });

  const filtered = params.month
    ? updates.filter((item) => {
        const date = item.publishedAt;
        if (!date) return false;
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yyyy = String(date.getFullYear());
        return `${yyyy}-${mm}` === params.month;
      })
    : updates;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Atualizações Diárias</h1>

      <form className="card grid gap-3 md:grid-cols-3" method="GET">
        <input className="input" defaultValue={params.q} name="q" placeholder="Buscar por termo" />
        <input className="input" defaultValue={params.month} name="month" type="month" />
        <button className="btn" type="submit">
          Filtrar
        </button>
      </form>

      <div className="space-y-3">
        {filtered.map((item) => (
          <Link className="card block" href={`/app/atualizacoes/${item.slug}`} key={item.id}>
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="text-sm text-muted">{formatDate(item.publishedAt)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
