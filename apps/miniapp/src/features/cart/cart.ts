import type { AddCartItemRequest, CartView } from "@ss13/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useLaunchMode } from "../../app/launch";
import { api } from "../../shared/api";
import { canLogin } from "../../shared/telegram/launch-mode";
import { clearLegacyCart, readLegacyCart } from "./legacy-cart";

export const CART_KEY = ["cart"] as const;

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Кошик серверний і прив'язаний до покупця, тож без входу через Telegram його немає. */
export const useCartAvailable = () => canLogin(useLaunchMode());

/** Кошик з актуальними цінами й наявністю. fresh — перезапитати при відкритті сторінки. */
export function useCart(options: { fresh?: boolean } = {}) {
  const enabled = useCartAvailable();
  return useQuery({
    queryKey: CART_KEY,
    queryFn: ({ signal }) => api.request<CartView>("/cart", { auth: true, signal }),
    enabled,
    staleTime: 30_000,
    refetchOnMount: options.fresh ? "always" : true,
  });
}

export const useCartCount = () => useCart().data?.count ?? 0;

/** Додавання, зміна кількості, видалення. Сервер повертає оновлений кошик. */
export function useCartMutations() {
  const queryClient = useQueryClient();
  const onSuccess = (cart: CartView) => queryClient.setQueryData(CART_KEY, cart);
  // Після конфлікту (залишок змінився) показуємо актуальний стан з сервера.
  const onError = () => void queryClient.invalidateQueries({ queryKey: CART_KEY });

  const add = useMutation({
    mutationFn: (input: AddCartItemRequest) =>
      api.request<CartView>("/cart/items", { method: "POST", body: input, auth: true }),
    onSuccess,
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.request<CartView>(`/cart/items/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { quantity },
        auth: true,
      }),
    onSuccess,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api.request<CartView>(`/cart/items/${encodeURIComponent(id)}`, {
        method: "DELETE",
        auth: true,
      }),
    onSuccess,
    onError,
  });
  return { add, update, remove };
}

/** Один раз переносить старий локальний кошик Етапу 2 на сервер. */
export function useLegacyCartMigration() {
  const enabled = useCartAvailable();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const storage = safeLocalStorage();
    const lines = readLegacyCart(storage);
    if (lines.length === 0) return;
    clearLegacyCart(storage);
    void (async () => {
      for (const line of lines) {
        // Товару могло вже не бути: така позиція просто не переноситься.
        await api
          .request<CartView>("/cart/items", { method: "POST", body: line, auth: true })
          .catch(() => undefined);
      }
      await queryClient.invalidateQueries({ queryKey: CART_KEY });
    })();
  }, [enabled, queryClient]);
}
