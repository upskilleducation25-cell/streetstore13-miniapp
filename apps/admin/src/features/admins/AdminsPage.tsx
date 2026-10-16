import type { AdminAccount, AdminCreateInput, AdminRole, AdminUpdateInput } from "@ss13/shared";
import { ADMIN_PASSWORD_LIMITS, ADMIN_ROLE_LABELS } from "@ss13/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, fieldErrors } from "../../shared/api";
import { formatDateTime } from "../../shared/lib/format";
import { Button } from "../../shared/ui/Button";
import { Dialog, useConfirm } from "../../shared/ui/Dialog";
import { Checkbox, Field, Select, TextInput } from "../../shared/ui/Field";
import { PageSpinner } from "../../shared/ui/Spinner";
import { Badge, ErrorState, PageHeader } from "../../shared/ui/States";
import { useToast } from "../../shared/ui/Toast";
import { useSession } from "../auth/session";

const ADMINS_KEY = ["admins"] as const;

function useAdmins() {
  return useQuery({ queryKey: ADMINS_KEY, queryFn: () => api<AdminAccount[]>("/admin/admins") });
}

function useAdminMutations() {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ADMINS_KEY });
  return {
    create: useMutation({
      mutationFn: (input: AdminCreateInput) =>
        api<AdminAccount>("/admin/admins", { method: "POST", body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: AdminUpdateInput }) =>
        api<AdminAccount>(`/admin/admins/${id}`, { method: "PATCH", body: input }),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (id: string) =>
        api<void>(`/admin/admins/${id}/revoke-sessions`, { method: "POST" }),
      onSuccess: refresh,
    }),
  };
}

const passwordProblem = (value: string, required: boolean) =>
  !value && !required
    ? undefined
    : value.length < ADMIN_PASSWORD_LIMITS.min
      ? `Щонайменше ${ADMIN_PASSWORD_LIMITS.min} символів`
      : undefined;

function AdminDialog({
  account,
  self,
  onClose,
}: {
  account: AdminAccount | null;
  self: boolean;
  onClose: () => void;
}) {
  const { create, update } = useAdminMutations();
  const toast = useToast();
  const [email, setEmail] = useState(account?.email ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [role, setRole] = useState<AdminRole>(account?.role ?? "MANAGER");
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const mutation = account ? update : create;
  const errors = fieldErrors(mutation.error);
  const pwError = touched ? passwordProblem(password, !account) : undefined;
  const valid =
    name.trim().length > 0 &&
    (account || email.trim().length > 0) &&
    !passwordProblem(password, !account);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const done = {
      onSuccess: () => {
        toast(account ? "Збережено" : "Адміністратора додано");
        onClose();
      },
    };
    if (account) {
      const input: AdminUpdateInput = { name: name.trim() };
      if (!self) {
        if (role !== account.role) input.role = role;
        if (isActive !== account.isActive) input.isActive = isActive;
      }
      if (password) input.password = password;
      update.mutate({ id: account.id, input }, done);
    } else {
      create.mutate({ email: email.trim(), name: name.trim(), role, password }, done);
    }
  };

  return (
    <Dialog
      open
      title={account ? account.name : "Новий адміністратор"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Скасувати</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={submit}>
            {account ? "Зберегти" : "Додати"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {account ? (
          <p className="text-muted">{account.email}</p>
        ) : (
          <Field label="Email" required error={errors.email}>
            {(props) => (
              <TextInput
                {...props}
                type="email"
                autoFocus
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
        )}
        <Field label="Ім'я" required error={errors.name}>
          {(props) => (
            <TextInput
              {...props}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Роль"
          error={errors.role}
          hint={
            self
              ? "Свою роль змінити не можна"
              : "Менеджер: товари, склад, фото, категорії, довідники"
          }
        >
          {(props) => (
            <Select
              {...props}
              value={role}
              disabled={self}
              onChange={(e) => setRole(e.target.value as AdminRole)}
            >
              {Object.entries(ADMIN_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={account ? "Новий пароль" : "Пароль"}
          required={!account}
          error={errors.password ?? pwError}
          hint={
            account
              ? "Порожньо — без змін. Після зміни всі сесії цього адміна завершаться."
              : `Від ${ADMIN_PASSWORD_LIMITS.min} символів. Передайте його особисто.`
          }
        >
          {(props) => (
            <TextInput
              {...props}
              type="password"
              autoComplete="new-password"
              maxLength={ADMIN_PASSWORD_LIMITS.max}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {account && !self && (
          <Checkbox
            label="Доступ увімкнено"
            checked={isActive}
            onChange={setIsActive}
            hint="Вимкнення одразу завершує всі сесії"
          />
        )}
        {mutation.error && Object.keys(errors).length === 0 && (
          <p role="alert" className="text-danger">
            {errorMessage(mutation.error)}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

export function AdminsPage() {
  const admins = useAdmins();
  const session = useSession();
  const { revoke } = useAdminMutations();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AdminAccount | "new" | null>(null);
  const selfId = session.data?.admin.id;

  if (admins.isPending) return <PageSpinner />;
  if (admins.isError)
    return <ErrorState error={admins.error} onRetry={() => void admins.refetch()} />;

  const revokeAll = async (account: AdminAccount) => {
    const ok = await confirm({
      title: `Завершити сесії «${account.name}»?`,
      message: "Адміністратора буде розлогінено на всіх пристроях.",
      confirmLabel: "Завершити",
      danger: true,
    });
    if (!ok) return;
    revoke.mutate(account.id, {
      onSuccess: () => toast("Сесії завершено"),
      onError: (error) => toast(errorMessage(error), "error"),
    });
  };

  return (
    <>
      <PageHeader
        title="Адміністратори"
        subtitle="Доступ до адмінки. Реєстрації немає — нових людей додає власник."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            + Додати
          </Button>
        }
      />
      <ul className="border border-line bg-panel">
        {admins.data.map((account) => {
          const self = account.id === selfId;
          return (
            <li
              key={account.id}
              className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {account.name}{" "}
                  {self && <span className="text-xs font-normal text-muted">(ви)</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {account.email} · вхід:{" "}
                  {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "ще не було"} ·
                  активних сесій: {account.activeSessions}
                </p>
              </div>
              <Badge tone={account.role === "OWNER" ? "solid" : "neutral"}>
                {ADMIN_ROLE_LABELS[account.role]}
              </Badge>
              {!account.isActive && <Badge tone="danger">Вимкнено</Badge>}
              <div className="flex gap-1">
                {!self && account.activeSessions > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => void revokeAll(account)}>
                    Завершити сесії
                  </Button>
                )}
                <Button size="sm" onClick={() => setEditing(account)}>
                  Змінити
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing && (
        <AdminDialog
          key={editing === "new" ? "new" : editing.id}
          account={editing === "new" ? null : editing}
          self={editing !== "new" && editing.id === selfId}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
