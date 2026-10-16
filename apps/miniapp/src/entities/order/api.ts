import type {
  CheckoutOptions,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderDetail,
  OrderSummary,
  Paginated,
} from "@ss13/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CART_KEY, useCartAvailable } from "../../features/cart/cart";
import { api } from "../../shared/api";

const orderKey = (number: string) => ["order", number] as const;

export const useCheckoutOptions = () =>
  useQuery({
    queryKey: ["checkout-options"],
    queryFn: ({ signal }) =>
      api.request<CheckoutOptions>("/checkout/options", { auth: true, signal }),
    enabled: useCartAvailable(),
    staleTime: 0,
  });

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateOrderRequest; idempotencyKey: string }) =>
      api.request<CreateOrderResponse>("/orders", {
        method: "POST",
        body,
        auth: true,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    onSuccess: ({ order }) => {
      queryClient.setQueryData(orderKey(order.number), order);
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["checkout-options"] });
    },
  });
}

export const useOrders = () =>
  useInfiniteQuery({
    queryKey: ["orders"],
    queryFn: ({ pageParam, signal }) =>
      api.request<Paginated<OrderSummary>>("/orders", {
        auth: true,
        query: { limit: 20, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: useCartAvailable(),
    refetchOnMount: "always",
  });

export const useOrder = (number: string) =>
  useQuery({
    queryKey: orderKey(number),
    queryFn: ({ signal }) =>
      api.request<OrderDetail>(`/orders/${encodeURIComponent(number)}`, { auth: true, signal }),
    enabled: useCartAvailable(),
  });

export function useCancelOrder(number: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.request<OrderDetail>(`/orders/${encodeURIComponent(number)}/cancel`, {
        method: "POST",
        auth: true,
      }),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKey(order.number), order);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: orderKey(number) }),
  });
}
