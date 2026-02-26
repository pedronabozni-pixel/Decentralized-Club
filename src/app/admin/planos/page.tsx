import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/access";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";

async function createPlan(formData: FormData) {
  "use server";
  await requireAdminSession();

  const name = String(formData.get("name") ?? "");
  const priceCents = Number(formData.get("priceCents") ?? "0");
  const kirvanoProductId = String(formData.get("kirvanoProductId") ?? "");
  const permissionsRaw = String(formData.get("permissionsJson") ?? "{}");

  if (!name || !kirvanoProductId || Number.isNaN(priceCents)) return;

  let permissionsJson: object = {};
  try {
    permissionsJson = JSON.parse(permissionsRaw);
  } catch {
    permissionsJson = { raw: permissionsRaw };
  }

  await db.plan.create({
    data: {
      name,
      priceCents,
      kirvanoProductId,
      permissionsJson
    }
  });

  revalidatePath("/admin/planos");
}

async function togglePlan(formData: FormData) {
  "use server";
  await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "false") === "true";

  if (!id) return;

  await db.plan.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/planos");
}

async function deletePlan(formData: FormData) {
  "use server";
  await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [subscriptionsCount, videosCount] = await Promise.all([
    db.subscription.count({ where: { planId: id } }),
    db.video.count({ where: { requiredPlanId: id } })
  ]);

  if (subscriptionsCount > 0 || videosCount > 0) {
    await db.plan.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/planos");
    return;
  }

  await db.plan.delete({ where: { id } });
  revalidatePath("/admin/planos");
}

export default async function AdminPlansPage() {
  await requireAdminSession();

  const plans = await db.plan.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Gestão de Planos</h1>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Criar plano</h2>
        <form action={createPlan} className="grid gap-2">
          <input className="input" name="name" placeholder="Nome do plano" required />
          <input className="input" name="priceCents" placeholder="Preço em centavos" required type="number" />
          <input className="input" name="kirvanoProductId" placeholder="ID do produto na Kirvano" required />
          <textarea
            className="input min-h-24"
            defaultValue='{"dailyUpdates":true,"analyses":["MACRO"],"videosModules":["base"]}'
            name="permissionsJson"
          />
          <button className="btn" type="submit">
            Salvar plano
          </button>
        </form>
      </section>

      <section className="space-y-2">
        {plans.map((plan) => (
          <article className="card flex flex-wrap items-center justify-between gap-2" key={plan.id}>
            <div>
              <h2 className="font-semibold">{plan.name}</h2>
              <p className="text-sm text-muted">
                {formatMoney(plan.priceCents)} • {plan.kirvanoProductId}
              </p>
            </div>
            <div className="flex gap-2">
              <form action={togglePlan}>
                <input name="id" type="hidden" value={plan.id} />
                <input name="isActive" type="hidden" value={String(!plan.isActive)} />
                <button className="btn-secondary" type="submit">
                  {plan.isActive ? "Desativar" : "Ativar"}
                </button>
              </form>
              <form action={deletePlan}>
                <input name="id" type="hidden" value={plan.id} />
                <button className="rounded-xl border border-red-500/40 px-4 py-2 font-semibold text-red-300 hover:bg-red-500/10" type="submit">
                  Excluir
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
