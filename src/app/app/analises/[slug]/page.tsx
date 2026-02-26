import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requireMemberSession } from "@/lib/access";

export default async function AnalysisDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireMemberSession();

  const { slug } = await params;
  const content = await db.analysis.findUnique({ where: { slug } });

  if (!content || !content.publishedAt) notFound();

  return (
    <article className="card space-y-4">
      <h1 className="text-2xl font-bold">{content.title}</h1>
      <p className="text-sm text-muted">
        {content.category} • {formatDate(content.publishedAt)}
      </p>
      {content.coverImage ? <img alt={content.title} className="w-full rounded-lg" src={content.coverImage} /> : null}
      <div className="prose prose-invert max-w-none text-sm text-text">{content.content}</div>
      {content.pdfUrl ? (
        <a className="btn-secondary inline-block" href={content.pdfUrl} rel="noreferrer" target="_blank">
          Abrir PDF anexo
        </a>
      ) : null}
    </article>
  );
}
