import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ADMIN_CONFIG, ADMIN_COOKIE_NAME } from "@/lib/store-config";
import { createProduct, getProducts } from "@/lib/store-data";
import type { Product } from "@/types/store";

function unauthorized() {
  return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (token !== ADMIN_CONFIG.sessionToken) {
    return unauthorized();
  }

  const body = (await request.json()) as Partial<Product>;
  const name = String(body.name ?? "Novo Produto").trim();
  const products = await getProducts();

  let baseSlug = slugify(body.slug ?? name) || "novo-produto";
  let slug = baseSlug;
  let count = 1;

  while (products.some((item) => item.slug === slug)) {
    count += 1;
    slug = `${baseSlug}-${count}`;
  }

  const product: Product = {
    id: "",
    slug,
    name,
    category: String(body.category ?? "Nova categoria"),
    costCents: Number(body.costCents ?? 0),
    priceCents: Number(body.priceCents ?? 0),
    shortDescription: String(body.shortDescription ?? "Descrição curta do produto."),
    description: String(body.description ?? "Descrição completa do produto."),
    image: String(body.image ?? ""),
    videoUrl: String(body.videoUrl ?? ""),
    hotmartUrl: String(body.hotmartUrl ?? "https://app.monetizze.com.br/checkout/SEULINK"),
    rating: Number(body.rating ?? 5),
    reviewsCount: Number(body.reviewsCount ?? 1),
    features: Array.isArray(body.features) ? body.features : ["Novo diferencial do produto"],
    stockHint: String(body.stockHint ?? "")
  };

  const created = await createProduct(product);

  revalidatePath("/loja");
  revalidatePath("/loja/favoritos");

  return NextResponse.json({ product: created });
}
