import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="brand-banner relative hidden overflow-hidden lg:flex lg:items-end lg:p-12">
        <div className="max-w-xl space-y-4">
          <p className="text-xs tracking-[0.3em] text-brand">DECENTRALIZED CLUB</p>
          <h1 className="brand-title text-6xl leading-none">Market Intelligence</h1>
          <p className="max-w-md text-sm text-muted">
            Análises e atualizações educacionais com uma experiência premium para membros.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-4 lg:p-10">
        <LoginForm />
      </section>
    </main>
  );
}
