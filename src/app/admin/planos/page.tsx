import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/access";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";

function parsePriceToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return null;

  const commaFormat = normalized.match(/^(\d+)(?:,(\d{1,2}))?$/);
  if (commaFormat) {
    const reais = Number(commaFormat[1]);
    const cents = Number((commaFormat[2] ?? "0").padEnd(2, "0"));
    return reais * 100 + cents;
  }

  const dotFormat = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (dotFormat) {
    const reais = Number(dotFormat[1]);
    const cents = Number((dotFormat[2] ?? "0").padEnd(2, "0"));
    return reais * 100 + cents;
  }

  return null;
}

async function createPlan(formData: FormData) {
  "use server";
  await requireAdminSession();

  const name = String(formData.get("name") ?? "");
  const priceInput = String(formData.get("price") ?? "");
  const priceCents = parsePriceToCents(priceInput);
  const kirvanoProductId = String(formData.get("kirvanoProductId") ?? "");
  const permissionsRaw = String(formData.get("permissionsJson") ?? "{}");

  if (!name || !kirvanoProductId || priceCents === null) return;

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

async function updatePlan(formData: FormData) {
  "use server";
  await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const priceInput = String(formData.get("price") ?? "").trim();
  const kirvanoProductId = String(formData.get("kirvanoProductId") ?? "").trim();
  const permissionsRaw = String(formData.get("permissionsJson") ?? "{}");
  const isActive = String(formData.get("isActive") ?? "false") === "true";

  if (!id || !name || !kirvanoProductId) return;

  const priceCents = parsePriceToCents(priceInput);
  if (priceCents === null) return;

  let permissionsJson: object = {};
  try {
    permissionsJson = JSON.parse(permissionsRaw);
  } catch {
    permissionsJson = { raw: permissionsRaw };
  }

  await db.plan.update({
    where: { id },
    data: {
      name,
      priceCents,
      kirvanoProductId,
      permissionsJson,
      isActive
    }
  });

  revalidatePath("/admin/planos");
}

async function deletePlan(formData: FormData) {
  "use server";
  await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.$transaction(async (tx) => {
    // Remove vínculos que impedem exclusão definitiva do plano.
    await tx.subscription.deleteMany({ where: { planId: id } });
    await tx.video.updateMany({ where: { requiredPlanId: id }, data: { requiredPlanId: null } });
    await tx.plan.delete({ where: { id } });
  });

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
          <input
            className="input"
            inputMode="decimal"
            name="price"
            placeholder="Preço (ex: 99 ou 99,90)"
            required
            type="text"
          />
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
          <article className="card space-y-3" key={plan.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                  <button
                    className="rounded-xl border border-red-500/40 px-4 py-2 font-semibold text-red-300 hover:bg-red-500/10"
                    type="submit"
                  >
                    Excluir
                  </button>
                </form>
              </div>
            </div>

            <details>
              <summary className="cursor-pointer text-sm text-muted">Editar plano</summary>
              <form action={updatePlan} className="mt-3 grid gap-2">
                <input name="id" type="hidden" value={plan.id} />
                <input className="input" defaultValue={plan.name} name="name" required />
                <input
                  className="input"
                  defaultValue={(plan.priceCents / 100).toFixed(2).replace(".", ",")}
                  inputMode="decimal"
                  name="price"
                  required
                  type="text"
                />
                <input className="input" defaultValue={plan.kirvanoProductId} name="kirvanoProductId" required />
                <textarea
                  className="input min-h-24"
                  defaultValue={JSON.stringify(plan.permissionsJson, null, 2)}
                  name="permissionsJson"
                />
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input defaultChecked={plan.isActive} name="isActive" type="checkbox" value="true" />
                  Plano ativo
                </label>
                <button className="btn w-fit" type="submit">
                  Salvar edição
                </button>
              </form>
            </details>
          </article>
        ))}
      </section>
    </div>
  );
}
