import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StoreAdminProductEditor } from "@/components/admin/store-admin-product-editor";
import { ADMIN_CONFIG, ADMIN_COOKIE_NAME } from "@/lib/store-config";
import { getProducts, getSiteContent } from "@/lib/store-data";

export default async function StoreAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (token !== ADMIN_CONFIG.sessionToken) {
    redirect("/loja/admin/login");
  }

  const [products, siteContent] = await Promise.all([getProducts(), getSiteContent()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-4xl">Admin da Loja</h1>
        <p className="mt-2 text-zinc-300">Edite nome, preço, descrição, imagem, vídeo e link Monetizze de cada produto.</p>
      </div>
      <StoreAdminProductEditor initialProducts={products} initialSiteContent={siteContent} />
    </div>
  );
}
