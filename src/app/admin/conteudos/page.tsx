import { revalidatePath } from "next/cache";
import { AnalysisCategory, VideoProvider } from "@prisma/client";
import { requireAdminSession } from "@/lib/access";
import { db } from "@/lib/db";
import { saveImageUpload } from "@/lib/uploads";
import { slugify } from "@/lib/utils";

async function createUpdate(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  const title = String(formData.get("title") ?? "");
  const content = String(formData.get("content") ?? "");
  const coverImageFile = formData.get("coverImageFile");
  if (!title || !content) return;

  const coverImage =
    coverImageFile instanceof File ? await saveImageUpload(coverImageFile, "updates") : null;

  await db.dailyUpdate.create({
    data: {
      title,
      slug: `${slugify(title)}-${Date.now()}`,
      content,
      coverImage,
      publishedAt: new Date(String(formData.get("publishedAt") || new Date().toISOString())),
      createdById: session.user.id
    }
  });

  revalidatePath("/admin/conteudos");
  revalidatePath("/app/atualizacoes");
}

async function createAnalysis(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  const title = String(formData.get("title") ?? "");
  const content = String(formData.get("content") ?? "");
  const coverImageFile = formData.get("coverImageFile");
  const category = String(formData.get("category") ?? "MACRO") as AnalysisCategory;
  if (!title || !content) return;

  const coverImage =
    coverImageFile instanceof File ? await saveImageUpload(coverImageFile, "analyses") : null;

  await db.analysis.create({
    data: {
      title,
      slug: `${slugify(title)}-${Date.now()}`,
      category,
      content,
      coverImage,
      pdfUrl: String(formData.get("pdfUrl") ?? "") || null,
      publishedAt: new Date(String(formData.get("publishedAt") || new Date().toISOString())),
      createdById: session.user.id
    }
  });

  revalidatePath("/admin/conteudos");
  revalidatePath("/app/analises");
}

async function createVideo(formData: FormData) {
  "use server";
  const session = await requireAdminSession();

  const title = String(formData.get("title") ?? "");
  const module = String(formData.get("module") ?? "base");
  const videoUrl = String(formData.get("videoUrl") ?? "");
  const provider = String(formData.get("provider") ?? "YOUTUBE") as VideoProvider;
  const requiredPlanId = String(formData.get("requiredPlanId") ?? "") || null;

  if (!title || !videoUrl) return;

  await db.video.create({
    data: {
      title,
      module,
      videoUrl,
      provider,
      requiredPlanId,
      publishedAt: new Date(String(formData.get("publishedAt") || new Date().toISOString())),
      createdById: session.user.id
    }
  });

  revalidatePath("/admin/conteudos");
  revalidatePath("/app/videos");
}

async function deleteContent(formData: FormData) {
  "use server";
  await requireAdminSession();

  const type = String(formData.get("type") ?? "");
  const id = String(formData.get("id") ?? "");

  if (!id || !type) return;

  if (type === "update") await db.dailyUpdate.delete({ where: { id } });
  if (type === "analysis") await db.analysis.delete({ where: { id } });
  if (type === "video") await db.video.delete({ where: { id } });

  revalidatePath("/admin/conteudos");
}

export default async function AdminContentsPage() {
  await requireAdminSession();

  const [updates, analyses, videos, plans] = await Promise.all([
    db.dailyUpdate.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.analysis.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.video.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.plan.findMany({ where: { isActive: true } })
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão de Conteúdos</h1>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Nova atualização diária</h2>
        <form action={createUpdate} className="grid gap-2">
          <input className="input" name="title" placeholder="Título" required />
          <textarea className="input min-h-28" name="content" placeholder="Conteúdo educacional" required />
          <label className="drop-input">
            <span className="text-sm font-medium">Adicionar imagem de capa</span>
            <span className="text-xs text-muted">Arraste a imagem aqui ou clique para selecionar</span>
            <input accept="image/*" className="mt-2 block text-sm text-muted" name="coverImageFile" type="file" />
          </label>
          <input className="input" name="publishedAt" type="datetime-local" />
          <button className="btn" type="submit">
            Publicar atualização
          </button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Nova análise</h2>
        <form action={createAnalysis} className="grid gap-2">
          <input className="input" name="title" placeholder="Título" required />
          <select className="input" name="category">
            <option value="MACRO">Macro</option>
            <option value="TECNICA">Técnica</option>
            <option value="NARRATIVAS">Narrativas</option>
            <option value="INSTITUCIONAL">Institucional</option>
            <option value="EUA">EUA</option>
          </select>
          <textarea className="input min-h-28" name="content" placeholder="Corpo da análise" required />
          <label className="drop-input">
            <span className="text-sm font-medium">Adicionar imagem de capa</span>
            <span className="text-xs text-muted">Arraste a imagem aqui ou clique para selecionar</span>
            <input accept="image/*" className="mt-2 block text-sm text-muted" name="coverImageFile" type="file" />
          </label>
          <input className="input" name="pdfUrl" placeholder="URL PDF (opcional)" />
          <input className="input" name="publishedAt" type="datetime-local" />
          <button className="btn" type="submit">
            Publicar análise
          </button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Novo vídeo</h2>
        <form action={createVideo} className="grid gap-2">
          <input className="input" name="title" placeholder="Título" required />
          <input className="input" name="module" placeholder="Módulo (ex: base)" required />
          <select className="input" name="provider">
            <option value="YOUTUBE">YouTube</option>
            <option value="VIMEO">Vimeo</option>
          </select>
          <input className="input" name="videoUrl" placeholder="URL embed" required />
          <select className="input" name="requiredPlanId">
            <option value="">Sem restrição</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          <input className="input" name="publishedAt" type="datetime-local" />
          <button className="btn" type="submit">
            Publicar vídeo
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">Excluir conteúdos</h2>
        <div className="space-y-2 text-sm">
          {[...updates.map((item) => ({ type: "update", id: item.id, title: item.title })), ...analyses.map((item) => ({ type: "analysis", id: item.id, title: item.title })), ...videos.map((item) => ({ type: "video", id: item.id, title: item.title }))].map((item) => (
            <form action={deleteContent} className="flex items-center justify-between gap-2 rounded border border-border p-2" key={item.id}>
              <span>{item.type.toUpperCase()} • {item.title}</span>
              <input name="type" type="hidden" value={item.type} />
              <input name="id" type="hidden" value={item.id} />
              <button className="btn-secondary" type="submit">Excluir</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
