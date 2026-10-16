import { Link } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { t } from "../shared/strings";
import { EmptyState } from "../shared/ui/States";

export default function NotFoundPage() {
  return (
    <>
      <PageHeader />
      <EmptyState
        title={t.errors.notFoundTitle}
        action={
          <Link
            to="/"
            className="inline-flex min-h-11 items-center border border-fg px-5 text-sm font-medium"
          >
            {t.nav.home}
          </Link>
        }
      />
    </>
  );
}
