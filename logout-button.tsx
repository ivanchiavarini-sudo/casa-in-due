"use client";

import { useTransition } from "react";
import { signOut } from "@/app/login/actions";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="button ghost tiny-button"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void signOut())}
    >
      {pending ? "Esco…" : "Esci"}
    </button>
  );
}
