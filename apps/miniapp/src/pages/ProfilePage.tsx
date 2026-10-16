import { PageHeader } from "../app/PageHeader";
import { useLaunchMode } from "../app/launch";
import { useMe } from "../entities/product/api";
import { canLogin } from "../shared/telegram/launch-mode";
import { t } from "../shared/strings";
import { UserIcon } from "../shared/ui/icons";
import { Skeleton } from "../shared/ui/Skeleton";

/** Мінімальний профіль: хто увійшов. Мої замовлення — Етап 3. */
export default function ProfilePage() {
  const mode = useLaunchMode();
  const me = useMe(canLogin(mode));
  const name = me.data
    ? [me.data.firstName, me.data.lastName].filter(Boolean).join(" ") ||
      me.data.username ||
      t.profile.guest
    : t.profile.guest;

  return (
    <>
      <PageHeader title={t.profile.title} />
      <div className="px-4 pt-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-hint">
            <UserIcon />
          </div>
          <div className="min-w-0">
            {me.isLoading ? (
              <Skeleton className="h-5 w-40" />
            ) : (
              <p className="truncate text-lg font-medium">{name}</p>
            )}
            {me.data?.username && <p className="text-sm text-hint">@{me.data.username}</p>}
          </div>
        </div>

        {mode === "browser" && <p className="mt-6 text-sm text-hint">{t.profile.notInTelegram}</p>}
        {canLogin(mode) && me.isError && (
          <p className="mt-6 text-sm text-hint">{t.profile.loginFailed}</p>
        )}
        {mode === "dev-mock" && <p className="mt-6 text-xs text-hint">{t.profile.devMode}</p>}

        <p className="mt-10 border-t border-line pt-6 text-sm text-hint">{t.profile.stage3}</p>
      </div>
    </>
  );
}
