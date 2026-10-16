import { t } from "../shared/strings";
import { Button } from "../shared/ui/States";

/** Неочікувана помилка рендеру: не білий екран, а повідомлення з перезавантаженням. */
export function RouteError() {
  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
    >
      <p className="text-sm text-hint">{t.errors.server}</p>
      <Button className="mt-6" variant="outline" onClick={() => window.location.reload()}>
        {t.common.retry}
      </Button>
    </div>
  );
}
