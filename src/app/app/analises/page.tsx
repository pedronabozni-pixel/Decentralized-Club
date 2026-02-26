import Link from "next/link";
import { AnalysisCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requireMemberSession } from "@/lib/access";

type Props = {
  searchParams: Promise<{
    category?: AnalysisCategory;
  }>;
};

export default async function AnalysesPage({ searchParams }: Props) {
  await requireMemberSession();
  const { category } = await searchParams;

  const analyses = await db.analysis.findMany({
    where: {
      publishedAt: { not: null },
      ...(category ? { category } : {})
    },
    orderBy: { publishedAt: "desc" }
  });

  const categories: AnalysisCategory[] = ["MACRO", "TECNICA", "NARRATIVAS", "INSTITUCIONAL", "EUA"];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Análises Exclusivas</h1>

      <form className="card flex flex-wrap gap-2" method="GET">
        <select className="input max-w-xs" defaultValue={category ?? ""} name="category">
          <option value="">Todas categorias</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="btn" type="submit">
          Filtrar
        </button>
      </form>

      <div className="space-y-3">
        {analyses.map((item) => (
          <Link className="card block" href={`/app/analises/${item.slug}`} key={item.id}>
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="text-sm text-muted">
              {item.category} • {formatDate(item.publishedAt)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
