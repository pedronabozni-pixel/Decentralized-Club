"use client";

import { FormEvent, useState } from "react";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, newPassword })
    });

    setLoading(false);

    if (!response.ok) {
      setMessage("Não foi possível redefinir. Verifique os dados.");
      return;
    }

    setMessage("Senha redefinida com sucesso. Você já pode entrar.");
  }

  return (
    <form className="card w-full max-w-md space-y-4" onSubmit={onSubmit}>
      <h1 className="text-2xl font-bold">Redefinir senha</h1>
      <p className="text-sm text-muted">Fluxo simplificado de MVP. Produção deve usar token por email.</p>

      <div>
        <label className="mb-1 block text-sm">Email</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      </div>

      <div>
        <label className="mb-1 block text-sm">Nova senha</label>
        <input
          className="input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          type="password"
          minLength={8}
          required
        />
      </div>

      {message && <p className="text-sm text-muted">{message}</p>}

      <button className="btn w-full" disabled={loading} type="submit">
        {loading ? "Salvando..." : "Atualizar senha"}
      </button>
    </form>
  );
}
