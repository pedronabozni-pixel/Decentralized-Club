import { HeroAnchor } from "@/components/store/hero-anchor";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ProductCard } from "@/components/store/product-card";
import { SocialProof } from "@/components/store/social-proof";
import { getProducts } from "@/lib/store-data";

export const dynamic = "force-dynamic";

export default async function StoreHomePage() {
  const products = await getProducts();
  const anchor = products.find((product) => product.isAnchor) ?? products[0];

  return (
    <div className="space-y-10">
      <div className="animate-fade-up">
        <HeroAnchor product={anchor} />
      </div>

      <section className="animate-fade-up grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-center md:grid-cols-3 md:text-left">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Escassez visual</p>
          <p className="mt-1 text-zinc-200">Lotes promocionais com unidades limitadas.</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Entrega rápida</p>
          <p className="mt-1 text-zinc-200">Vendas para todo o Brasil</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Compra segura</p>
          <p className="mt-1 text-zinc-200">Checkout externo via Monetizze para maior confiança.</p>
        </div>
      </section>

      <section className="animate-fade-up space-y-4">
        <h2 className="font-serif text-3xl">Produtos em destaque</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <div className="animate-fade-up">
        <SocialProof />
      </div>
      <div className="animate-fade-up">
        <NewsletterForm />
      </div>
    </div>
  );
}
