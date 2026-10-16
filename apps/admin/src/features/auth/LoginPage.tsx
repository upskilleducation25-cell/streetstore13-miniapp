import { useState } from "react";
import { Navigate, useSearchParams } from "react-router";

import { errorMessage, fieldErrors } from "../../shared/api";
import { Button } from "../../shared/ui/Button";
import { Field, TextInput } from "../../shared/ui/Field";
import { PageSpinner } from "../../shared/ui/Spinner";
import { useLogin, useSession } from "./session";

/** Тільки внутрішні шляхи: ?next=https://… не виведе за межі адмінки. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/products";
}

export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (session.isPending) return <PageSpinner />;
  if (session.data) return <Navigate to={safeNext(params.get("next"))} replace />;

  const errors = fieldErrors(login.error);
  const generalError =
    login.error && Object.keys(errors).length === 0 ? errorMessage(login.error) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-xs tracking-[0.3em] text-muted uppercase">Адмін-панель</p>
        <h1 className="mt-2 mb-8 text-3xl font-semibold tracking-tight">STREETSTORE.13</h1>
        <form
          className="flex flex-col gap-5 border border-line bg-panel p-6"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate({ email: email.trim(), password });
          }}
          noValidate
        >
          <Field label="Email" error={errors.email} required>
            {(props) => (
              <TextInput
                {...props}
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            )}
          </Field>
          <Field label="Пароль" error={errors.password} required>
            {(props) => (
              <TextInput
                {...props}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            )}
          </Field>
          {generalError && (
            <p role="alert" className="text-sm text-danger">
              {generalError}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={login.isPending}
            disabled={!email || !password}
          >
            Увійти
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted">
          Облікові записи створює власник магазину. Забули пароль — зверніться до власника.
        </p>
      </div>
    </main>
  );
}
