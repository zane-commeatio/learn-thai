"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type LoginFormProps = {
  hasError: boolean;
  devDefaults?: {
    email: string;
    password: string;
  };
};

export default function LoginForm({ hasError, devDefaults }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const didShowInvalidCredentialsToast = useRef(false);

  useEffect(() => {
    if (!hasError || didShowInvalidCredentialsToast.current) {
      return;
    }

    toast.error("Invalid email or password.");
    didShowInvalidCredentialsToast.current = true;
  }, [hasError]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Learn Thai</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Admin Login</h1>
        <p className="text-sm text-slate-600">Sign in to review uploads and monitor processing jobs.</p>
      </div>

      <form className="space-y-4" method="post" action="/api/admin/login">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Log in
        </button>

        {devDefaults ? (
          <button
            type="button"
            onClick={() => {
              setEmail(devDefaults.email);
              setPassword(devDefaults.password);
            }}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Autofill dev admin credentials
          </button>
        ) : null}
      </form>
    </div>
  );
}
