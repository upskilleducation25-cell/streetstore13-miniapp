import { ADMIN_PASSWORD_LIMITS, ADMIN_ROLE_LABELS } from "@ss13/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, fieldErrors } from "../../shared/api";
import { Button } from "../../shared/ui/Button";
import { Field, TextInput } from "../../shared/ui/Field";
import { PageHeader, Section } from "../../shared/ui/States";
import { useToast } from "../../shared/ui/Toast";
import { useSession } from "../auth/session";

export function AccountPage() {
  const session = useSession();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [touched, setTouched] = useState(false);
  const change = useMutation({
    mutationFn: () =>
      api<void>("/admin/auth/password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setRepeat("");
      setTouched(false);
      toast("Пароль змінено. Інші сесії завершено.");
    },
  });
  const errors = fieldErrors(change.error);
  const nextError =
    touched && next.length < ADMIN_PASSWORD_LIMITS.min
      ? `Щонайменше ${ADMIN_PASSWORD_LIMITS.min} символів`
      : undefined;
  const repeatError = touched && repeat !== next ? "Паролі не збігаються" : undefined;
  const admin = session.data?.admin;

  return (
    <>
      <PageHeader
        title="Мій акаунт"
        subtitle={admin ? `${admin.email} · ${ADMIN_ROLE_LABELS[admin.role]}` : undefined}
      />
      <Section
        title="Зміна пароля"
        description="Після зміни ця сесія лишається, а вхід на інших пристроях завершиться."
      >
        <form
          className="flex max-w-sm flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (!current || next.length < ADMIN_PASSWORD_LIMITS.min || repeat !== next) return;
            change.mutate();
          }}
        >
          <Field label="Поточний пароль" required error={errors.currentPassword}>
            {(props) => (
              <TextInput
                {...props}
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Новий пароль"
            required
            error={errors.newPassword ?? nextError}
            hint={`Від ${ADMIN_PASSWORD_LIMITS.min} символів`}
          >
            {(props) => (
              <TextInput
                {...props}
                type="password"
                autoComplete="new-password"
                maxLength={ADMIN_PASSWORD_LIMITS.max}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            )}
          </Field>
          <Field label="Повторіть новий пароль" required error={repeatError}>
            {(props) => (
              <TextInput
                {...props}
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            )}
          </Field>
          {change.error && Object.keys(errors).length === 0 && (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(change.error)}
            </p>
          )}
          <Button type="submit" variant="primary" loading={change.isPending} className="self-start">
            Змінити пароль
          </Button>
        </form>
      </Section>
    </>
  );
}
