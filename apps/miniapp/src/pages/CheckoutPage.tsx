import type { CheckoutOptions, CheckoutProblem } from "@ss13/shared";
import { CHECKOUT_LIMITS, formatUah } from "@ss13/shared";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { useCheckoutOptions, useCreateOrder } from "../entities/order/api";
import { useCart, useCartAvailable } from "../features/cart/cart";
import {
  apiFieldErrors,
  type CheckoutErrors,
  type CheckoutField,
  type CheckoutForm,
  initialCheckoutForm,
  newIdempotencyKey,
  toCreateOrderRequest,
  validateCheckout,
} from "../features/checkout/form";
import { ApiError } from "../shared/api";
import { t } from "../shared/strings";
import { MainButton } from "../shared/telegram/MainButton";
import { canRequestContact, haptic, requestPhone } from "../shared/telegram/telegram";
import { Skeleton } from "../shared/ui/Skeleton";
import { Chip } from "../shared/ui/Chip";
import { ErrorState, errorMessage } from "../shared/ui/States";
import { showToast } from "../shared/ui/Toast";

const inputClass =
  "mt-1.5 block min-h-11 w-full border border-line bg-bg px-3 text-base outline-none focus:border-fg aria-[invalid=true]:border-sale";

function Field({
  id,
  label,
  error,
  children,
  aside,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={id} className="text-xs uppercase tracking-[0.12em] text-hint">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-sale">
          {error}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-line pt-5">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function CheckoutView({ options }: { options: CheckoutOptions }) {
  const navigate = useNavigate();
  const cart = useCart();
  const createOrder = useCreateOrder();
  const [form, setForm] = useState<CheckoutForm>(() =>
    initialCheckoutForm(options.prefill, options.deliveryServices[0]?.code),
  );
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  // Один ключ на спробу: повторне натискання чи обрив мережі не створять друге замовлення.
  const idempotencyKey = useRef(newIdempotencyKey());
  const formRef = useRef<HTMLFormElement>(null);

  const service = options.deliveryServices.find((s) => s.code === form.deliveryServiceCode);
  const total = cart.data?.total ?? 0;

  const set = (field: CheckoutField) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const fillPhone = async () => {
    const phone = await requestPhone();
    if (phone) set("customerPhone")(phone);
  };

  const submit = () => {
    if (createOrder.isPending || !cart.data) return;
    const found = validateCheckout(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      haptic.error();
      showToast(t.checkout.errors.fixForm);
      formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    setNotice(null);
    createOrder.mutate(
      { body: toCreateOrderRequest(form, total), idempotencyKey: idempotencyKey.current },
      {
        onSuccess: ({ order }) => {
          haptic.success();
          navigate(`/order/${encodeURIComponent(order.number)}/success`, { replace: true });
        },
        onError: async (error) => {
          haptic.error();
          if (!(error instanceof ApiError)) {
            showToast(errorMessage(error));
            return;
          }
          if (error.code === "VALIDATION_ERROR") {
            setErrors(apiFieldErrors(error.details));
            showToast(error.message);
            return;
          }
          if (error.code === "PRICE_CHANGED") {
            const fresh = await cart.refetch();
            setNotice(t.checkout.priceChanged(formatUah(fresh.data?.total ?? 0)));
            return;
          }
          if (error.code === "CART_ITEMS_UNAVAILABLE" || error.code === "CART_EMPTY") {
            const problems = (error.details as { problems?: CheckoutProblem[] } | undefined)
              ?.problems;
            await cart.refetch();
            showToast(problems?.length ? t.checkout.itemsUnavailable : t.checkout.cartEmpty);
            navigate("/cart", { replace: true });
            return;
          }
          // Мережа чи сервер: той самий ключ — повтор безпечний.
          showToast(errorMessage(error));
        },
      },
    );
  };

  if (cart.data && !cart.data.canCheckout) return <Navigate to="/cart" replace />;

  const fieldProps = (field: CheckoutField) => ({
    id: `checkout-${field}`,
    value: form[field],
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `checkout-${field}-error` : undefined,
    onChange: (event: { target: { value: string } }) => set(field)(event.target.value),
  });

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-6 px-4 pb-28 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {notice && (
        <p role="alert" className="bg-surface px-3 py-2.5 text-sm">
          {notice}
        </p>
      )}

      <Section title={t.checkout.contacts}>
        <Field id="checkout-customerName" label={t.checkout.name} error={errors.customerName}>
          <input
            {...fieldProps("customerName")}
            autoComplete="name"
            maxLength={CHECKOUT_LIMITS.customerName}
            className={inputClass}
          />
        </Field>
        <Field
          id="checkout-customerPhone"
          label={t.checkout.phone}
          error={errors.customerPhone}
          aside={
            canRequestContact() ? (
              <button type="button" className="text-xs underline" onClick={fillPhone}>
                {t.checkout.phoneFromTelegram}
              </button>
            ) : undefined
          }
        >
          <input
            {...fieldProps("customerPhone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t.checkout.phonePlaceholder}
            maxLength={20}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title={t.checkout.delivery}>
        <div role="group" aria-label={t.checkout.delivery} className="flex flex-wrap gap-2">
          {options.deliveryServices.map((option) => (
            <Chip
              key={option.code}
              selected={form.deliveryServiceCode === option.code}
              onClick={() => set("deliveryServiceCode")(option.code)}
            >
              {option.name}
            </Chip>
          ))}
        </div>
        {errors.deliveryServiceCode && (
          <p className="text-xs text-sale">{errors.deliveryServiceCode}</p>
        )}
        <Field id="checkout-city" label={t.checkout.city} error={errors.city}>
          <input
            {...fieldProps("city")}
            autoComplete="address-level2"
            maxLength={CHECKOUT_LIMITS.city}
            className={inputClass}
          />
        </Field>
        <Field
          id="checkout-deliveryPoint"
          label={
            service?.supportsLockers ? t.checkout.deliveryPointOrLocker : t.checkout.deliveryPoint
          }
          error={errors.deliveryPoint}
        >
          <input
            {...fieldProps("deliveryPoint")}
            placeholder={t.checkout.deliveryPointPlaceholder}
            maxLength={CHECKOUT_LIMITS.deliveryPoint}
            className={inputClass}
          />
        </Field>
        <Field id="checkout-comment" label={t.checkout.comment} error={errors.comment}>
          <textarea
            {...fieldProps("comment")}
            rows={3}
            placeholder={t.checkout.commentPlaceholder}
            maxLength={CHECKOUT_LIMITS.comment}
            className={`${inputClass} py-2.5`}
          />
        </Field>
      </Section>

      <Section title={t.checkout.payment}>
        {options.paymentMethods[0] && <p className="text-sm">{options.paymentMethods[0].name}</p>}
        <p className="text-sm text-hint">{t.checkout.paymentInfo}</p>
      </Section>

      {cart.data && (
        <Section title={t.checkout.summary}>
          <ul className="space-y-2 text-sm">
            {cart.data.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {item.brand} {item.name}
                  <span className="text-hint">
                    {" "}
                    · {item.colorName}, {item.sizeLabel} × {item.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{formatUah(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-hint">{t.cart.delivery}</dt>
              <dd className="text-hint">{t.cart.deliveryByCarrier}</dd>
            </div>
            <div className="flex justify-between text-base font-medium">
              <dt>{t.cart.total}</dt>
              <dd className="tabular-nums">{formatUah(total)}</dd>
            </div>
          </dl>
        </Section>
      )}

      <MainButton
        text={t.checkout.confirm(formatUah(total))}
        disabled={!cart.data?.canCheckout}
        progress={createOrder.isPending}
        onClick={submit}
      />
    </form>
  );
}

export default function CheckoutPage() {
  const available = useCartAvailable();
  const options = useCheckoutOptions();
  const cart = useCart({ fresh: true });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!available) return <Navigate to="/cart" replace />;
  if (cart.data && cart.data.items.length === 0) return <Navigate to="/cart" replace />;

  return (
    <>
      <PageHeader title={t.checkout.title} />
      {options.isPending || cart.isPending ? (
        <div className="space-y-4 px-4 pt-4" aria-hidden="true">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </div>
      ) : options.isError ? (
        <ErrorState error={options.error} onRetry={() => void options.refetch()} />
      ) : cart.isError ? (
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
      ) : (
        <CheckoutView options={options.data} />
      )}
    </>
  );
}
