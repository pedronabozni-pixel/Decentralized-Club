import type { Metadata } from "next";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";

export const metadata: Metadata = {
  title: {
    default: "Genesis Distribuidora | Loja Oficial",
    template: "%s | Genesis Distribuidora"
  },
  description:
    "Loja oficial da Genesis Distribuidora com tecnologia premium, produto destaque H12 Ultra SE e compra rápida via Monetizze.",
  openGraph: {
    title: "Genesis Distribuidora",
    description: "Produtos de tecnologia com foco em alta conversão.",
    type: "website"
  }
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <StoreHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      <StoreFooter />
    </div>
  );
}
