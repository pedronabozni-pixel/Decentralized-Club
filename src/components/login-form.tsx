"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    setLoading(false);

    if (result?.error) {
      setError("Credenciais inválidas ou acesso bloqueado.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  const queryError = searchParams.get("error");

  return (
    <form className="card w-full max-w-md space-y-4 border-brand/30" onSubmit={onSubmit}>
      <div className="glass-line -mx-4 -mt-4 rounded-t-2xl px-4 pb-4 pt-3">
        <Image alt="Decentralized Club" className="h-20 w-auto" height={80} src="/brand/logo.svg" width={240} />
        <p className="text-xs tracking-[0.22em] text-muted">MEMBER ACCESS</p>
      </div>

      <div>
        <label className="mb-1 block text-sm">Email</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      </div>

      <div>
        <label className="mb-1 block text-sm">Senha</label>
        <input
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />
      </div>

      {(error || queryError) && (
        <p className="rounded bg-red-500/10 p-2 text-sm text-red-300">
          {error || "Seu acesso está bloqueado por status de assinatura."}
        </p>
      )}

      <button className="btn w-full" disabled={loading} type="submit">
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <a className="text-sm text-muted underline underline-offset-4" href="/reset-password">
        Esqueci minha senha
      </a>
    </form>
  );
}
