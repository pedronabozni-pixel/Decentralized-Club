"use client";

import { useState } from "react";
import type { Product, SiteContent } from "@/types/store";

type Message = { slug: string; text: string } | null;

function centsToReais(cents: number) {
  return (cents / 100).toFixed(2);
}

function reaisToCents(value: string) {
  const normalized = value.replace(",", ".").trim();
  const amount = Number.parseFloat(normalized);
  if (Number.isNaN(amount)) {
    return 0;
  }
  return Math.round(amount * 100);
}

function getMediaLabel(value?: string) {
  if (!value) return "Nenhum vídeo cadastrado.";
  const cleaned = value.split("?")[0];
  const parts = cleaned.split("/");
  return parts[parts.length - 1] || value;
}

export function StoreAdminProductEditor({
  initialProducts,
  initialSiteContent,
  loginPath = "/loja/admin/login"
}: {
  initialProducts: Product[];
  initialSiteContent: SiteContent;
  loginPath?: string;
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [siteContent, setSiteContent] = useState<SiteContent>(initialSiteContent);
  const [message, setMessage] = useState<Message>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [savingSiteContent, setSavingSiteContent] = useState(false);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [uploadingImageSlug, setUploadingImageSlug] = useState<string | null>(null);
  const [uploadingVideoSlug, setUploadingVideoSlug] = useState<string | null>(null);

  async function saveProduct(product: Product) {
    setSavingSlug(product.slug);
    const response = await fetch(`/api/loja-admin/products/${product.slug}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product)
    });
    setSavingSlug(null);

    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setMessage({ slug: product.slug, text: data.message ?? "Falha ao salvar." });
      return;
    }

    setMessage({ slug: product.slug, text: "Produto atualizado com sucesso." });
  }

  function updateField<T extends keyof Product>(index: number, field: T, value: Product[T]) {
    // Atualiza somente o produto editado sem recarregar a página.
    setProducts((current) => {
      const clone = [...current];
      clone[index] = { ...clone[index], [field]: value };
      return clone;
    });
  }

  async function logout() {
    // Limpa cookie de sessão do admin da loja.
    await fetch("/api/loja-admin/logout", { method: "POST", credentials: "include" });
    window.location.href = loginPath;
  }

  async function addProduct() {
    setCreatingProduct(true);
    const response = await fetch("/api/loja-admin/products", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Novo Produto ${products.length + 1}`,
        category: "Nova categoria",
        costCents: 0,
        priceCents: 0,
        shortDescription: "Descrição curta do produto.",
        description: "Descrição completa do produto.",
        image: "",
        videoUrl: "",
        hotmartUrl: "https://app.monetizze.com.br/checkout/SEULINK",
        rating: 5,
        reviewsCount: 1,
        features: ["Novo diferencial do produto"],
        stockHint: ""
      })
    });
    setCreatingProduct(false);

    const data = (await response.json()) as { product?: Product; message?: string };

    if (!response.ok || !data.product) {
      setMessage({ slug: "global", text: data.message ?? "Falha ao adicionar produto." });
      return;
    }

    setProducts((current) => [...current, data.product!]);
    setMessage({ slug: "global", text: "Produto adicionado com sucesso." });
  }

  async function removeProduct(slug: string) {
    const shouldDelete = window.confirm("Tem certeza que deseja excluir este produto?");
    if (!shouldDelete) return;

    setDeletingSlug(slug);
    const response = await fetch("/api/loja-admin/products/delete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug })
    });
    setDeletingSlug(null);

    const raw = await response.text();
    let data: { message?: string } = {};
    try {
      data = raw ? (JSON.parse(raw) as { message?: string }) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      setMessage({ slug, text: data.message ?? `Falha ao excluir produto (HTTP ${response.status}).` });
      return;
    }

    setProducts((current) => current.filter((item) => item.slug !== slug));
    setMessage({ slug: "global", text: "Produto excluído com sucesso." });
  }

  async function uploadImage(index: number, slug: string, file: File | null) {
    if (!file) return;

    const formData = new FormData();
    formData.append("imageFile", file);

    setUploadingImageSlug(slug);
    const response = await fetch("/api/loja-admin/upload-image", {
      method: "POST",
      credentials: "include",
      body: formData
    });
    setUploadingImageSlug(null);

    const data = (await response.json()) as { imageUrl?: string; message?: string };

    if (!response.ok || !data.imageUrl) {
      setMessage({ slug, text: data.message ?? "Falha no upload da imagem." });
      return;
    }

    updateField(index, "image", data.imageUrl);
    setMessage({ slug, text: "Imagem enviada. Salve o produto para persistir." });
  }

  async function uploadVideo(index: number, slug: string, file: File | null) {
    if (!file) return;

    const formData = new FormData();
    formData.append("videoFile", file);

    setUploadingVideoSlug(slug);
    const response = await fetch("/api/loja-admin/upload-video", {
      method: "POST",
      credentials: "include",
      body: formData
    });
    setUploadingVideoSlug(null);

    const data = (await response.json()) as { videoUrl?: string; message?: string };

    if (!response.ok || !data.videoUrl) {
      setMessage({ slug, text: data.message ?? "Falha no upload do vídeo." });
      return;
    }

    updateField(index, "videoUrl", data.videoUrl);
    setMessage({ slug, text: "Vídeo enviado. Salve o produto para persistir." });
  }

  async function saveSiteContent() {
    setSavingSiteContent(true);
    const response = await fetch("/api/loja-admin/site-content", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(siteContent)
    });
    setSavingSiteContent(false);

    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setMessage({ slug: "global", text: data.message ?? "Falha ao salvar conteúdo do site." });
      return;
    }

    setMessage({ slug: "global", text: "Conteúdo do site atualizado com sucesso." });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <p className="text-sm text-zinc-300">Edição local em JSON (src/data/products.json).</p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
            disabled={creatingProduct}
            onClick={addProduct}
            type="button"
          >
            {creatingProduct ? "Adicionando..." : "Adicionar produto"}
          </button>
          <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200" onClick={logout} type="button">
            Sair
          </button>
        </div>
      </div>
      {message?.slug === "global" ? <p className="text-sm text-zinc-300">{message.text}</p> : null}

      <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="font-serif text-2xl text-zinc-100">Conteúdo do site</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-zinc-300 md:col-span-2">
            Título da página Sobre
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) =>
                setSiteContent((current) => ({ ...current, about: { ...current.about, title: event.target.value } }))
              }
              value={siteContent.about.title}
            />
          </label>

          <label className="text-sm text-zinc-300 md:col-span-2">
            Sobre - parágrafo 1
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) =>
                setSiteContent((current) => ({ ...current, about: { ...current.about, paragraph1: event.target.value } }))
              }
              value={siteContent.about.paragraph1}
            />
          </label>

          <label className="text-sm text-zinc-300 md:col-span-2">
            Sobre - parágrafo 2
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) =>
                setSiteContent((current) => ({ ...current, about: { ...current.about, paragraph2: event.target.value } }))
              }
              value={siteContent.about.paragraph2}
            />
          </label>

          <label className="text-sm text-zinc-300 md:col-span-2">
            Sobre - parágrafo 3
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) =>
                setSiteContent((current) => ({ ...current, about: { ...current.about, paragraph3: event.target.value } }))
              }
              value={siteContent.about.paragraph3}
            />
          </label>

          <label className="text-sm text-zinc-300">
            Contato - título
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) =>
                setSiteContent((current) => ({ ...current, contact: { ...current.contact, title: event.target.value } }))
              }
              value={siteContent.contact.title}
            />
          </label>

          <label className="text-sm text-zinc-300">
            Contato - subtítulo
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) =>
                setSiteContent((current) => ({ ...current, contact: { ...current.contact, subtitle: event.target.value } }))
              }
              value={siteContent.contact.subtitle}
            />
          </label>

          <label className="text-sm text-zinc-300">
            E-mail
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) =>
                setSiteContent((current) => ({ ...current, contact: { ...current.contact, email: event.target.value } }))
              }
              value={siteContent.contact.email}
            />
          </label>

          <label className="text-sm text-zinc-300">
            WhatsApp
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) =>
                setSiteContent((current) => ({ ...current, contact: { ...current.contact, whatsapp: event.target.value } }))
              }
              value={siteContent.contact.whatsapp}
            />
          </label>

          <label className="text-sm text-zinc-300 md:col-span-2">
            Horário de atendimento
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) =>
                setSiteContent((current) => ({ ...current, contact: { ...current.contact, hours: event.target.value } }))
              }
              value={siteContent.contact.hours}
            />
          </label>
        </div>

        <button
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
          disabled={savingSiteContent}
          onClick={saveSiteContent}
          type="button"
        >
          {savingSiteContent ? "Salvando conteúdo..." : "Salvar conteúdo do site"}
        </button>
      </section>

      {products.map((product, index) => (
        <article className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4" key={product.slug}>
          <h3 className="font-serif text-xl text-zinc-100">{product.name}</h3>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-zinc-300">
              Categoria
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => updateField(index, "category", event.target.value)}
                value={product.category}
              />
            </label>

            <label className="text-sm text-zinc-300">
              Custo (R$)
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => updateField(index, "costCents", reaisToCents(event.target.value))}
                type="number"
                min="0"
                step="0.01"
                value={centsToReais(product.costCents)}
              />
            </label>

            <label className="text-sm text-zinc-300">
              Nome
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => updateField(index, "name", event.target.value)}
                value={product.name}
              />
            </label>

            <label className="text-sm text-zinc-300">
              Preço de venda (R$)
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => updateField(index, "priceCents", reaisToCents(event.target.value))}
                type="number"
                min="0"
                step="0.01"
                value={centsToReais(product.priceCents)}
              />
            </label>

            <label className="text-sm text-zinc-300 md:col-span-2">
              Descrição curta
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => updateField(index, "shortDescription", event.target.value)}
                value={product.shortDescription}
              />
            </label>

            <label className="text-sm text-zinc-300 md:col-span-2">
              Descrição completa
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => updateField(index, "description", event.target.value)}
                value={product.description}
              />
            </label>

            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 md:col-span-2">
              <p className="text-sm font-medium text-zinc-200">Imagem do produto (URL ou arquivo)</p>
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => updateField(index, "image", event.target.value)}
                placeholder="https://... ou /uploads/store/arquivo.jpg"
                value={product.image}
              />
              <input
                accept="image/*"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => uploadImage(index, product.slug, event.target.files?.[0] ?? null)}
                type="file"
              />
              <span className="block text-xs text-zinc-400">
                {uploadingImageSlug === product.slug
                  ? "Enviando imagem..."
                  : "Você pode colar a URL ou enviar um arquivo. Formatos: JPG, PNG, WEBP, GIF e SVG."}
              </span>
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 md:col-span-2">
              <p className="text-sm font-medium text-zinc-200">Vídeo do produto (URL ou arquivo)</p>
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => updateField(index, "videoUrl", event.target.value)}
                placeholder="https://... ou /uploads/store/arquivo.mp4"
                value={product.videoUrl ?? ""}
              />
              <input
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => uploadVideo(index, product.slug, event.target.files?.[0] ?? null)}
                type="file"
              />
              <span className="block text-xs text-zinc-400">
                {uploadingVideoSlug === product.slug
                  ? "Enviando vídeo..."
                  : "Você pode colar a URL ou enviar um arquivo. Formatos: MP4, WEBM, OGG e MOV."}
              </span>
            </div>

            <label className="text-sm text-zinc-300 md:col-span-2">
              Link Monetizze
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => updateField(index, "hotmartUrl", event.target.value)}
                value={product.hotmartUrl}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950"
              disabled={savingSlug === product.slug}
              onClick={() => saveProduct(product)}
              type="button"
            >
              {savingSlug === product.slug ? `Salvando ${product.name}...` : `Salvar ${product.name}`}
            </button>
            <button
              className="rounded-lg border border-red-400/50 px-4 py-2 text-sm font-semibold text-red-300"
              disabled={deletingSlug === product.slug}
              onClick={() => removeProduct(product.slug)}
              type="button"
            >
              {deletingSlug === product.slug ? "Excluindo..." : "Excluir produto"}
            </button>
          </div>
          <p className="text-sm text-zinc-400">
            Margem bruta estimada: R$ {((product.priceCents - product.costCents) / 100).toFixed(2)}
          </p>
          <p className="text-sm text-zinc-400">Vídeo atual: {getMediaLabel(product.videoUrl)}</p>
          {message?.slug === product.slug ? <p className="text-sm text-zinc-300">{message.text}</p> : null}
        </article>
      ))}
    </div>
  );
}
