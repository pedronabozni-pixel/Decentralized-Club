import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

const links = [
  { href: "/admin", label: "Resumo" },
  { href: "/admin/conteudos", label: "Conteúdos" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/planos", label: "Planos" },
  { href: "/admin/metricas", label: "Métricas" }
];

export function AdminNav() {
  return (
    <aside className="card h-fit space-y-4 border-brand/25">
      <div className="glass-line -mx-4 -mt-4 rounded-t-2xl px-4 pb-3 pt-3">
        <Image alt="Decentralized Club" className="h-14 w-auto" height={56} src="/brand/logo.svg" width={180} />
        <h2 className="brand-title text-xl">Área Admin</h2>
      </div>
      <nav className="space-y-2">
        {links.map((link) => (
          <Link
            className="block rounded-xl border border-transparent px-3 py-2 text-sm transition hover:border-brand/40 hover:bg-panelSoft"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <SignOutButton />
    </aside>
  );
}
