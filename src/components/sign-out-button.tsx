"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      className="btn-secondary w-full"
      onClick={() => {
        signOut({ callbackUrl: "/login" });
      }}
      type="button"
    >
      Sair
    </button>
  );
}
