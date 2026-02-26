import { MemberNav } from "@/components/member-nav";
import { requireMemberSession } from "@/lib/access";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  await requireMemberSession();

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[220px_1fr]">
      <MemberNav />
      <section className="space-y-4">{children}</section>
    </main>
  );
}
