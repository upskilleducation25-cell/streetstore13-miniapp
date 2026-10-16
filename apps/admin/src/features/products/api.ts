import type {
  AdminCatalogDictionaries,
  AdminImageUpdateInput,
  AdminInventoryMovement,
  AdminProductCreateInput,
  AdminProductDetail,
  AdminProductImage,
  AdminProductInput,
  AdminProductListResponse,
  AdminSaveVariantsInput,
  AdminStockAdjustInput,
} from "@ss13/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type QueryValueRecord } from "../../shared/api";

export const DICTIONARIES_KEY = ["dictionaries"] as const;
export const productKey = (id: string) => ["product", id] as const;

export function useDictionaries() {
  return useQuery({
    queryKey: DICTIONARIES_KEY,
    queryFn: () => api<AdminCatalogDictionaries>("/admin/dictionaries"),
    staleTime: 60_000,
  });
}

export function useProducts(query: QueryValueRecord) {
  return useQuery({
    queryKey: ["products", query],
    queryFn: ({ signal }) => api<AdminProductListResponse>("/admin/products", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: productKey(id ?? ""),
    queryFn: () => api<AdminProductDetail>(`/admin/products/${id}`),
    enabled: Boolean(id),
  });
}

export function useMovements(id: string) {
  return useQuery({
    queryKey: ["movements", id],
    queryFn: () =>
      api<AdminInventoryMovement[]>(`/admin/products/${id}/movements`, { query: { limit: 100 } }),
  });
}

/** Після будь-якої зміни товару оновлюємо форму, список, журнал і лічильники довідників. */
function useProductInvalidation() {
  const queryClient = useQueryClient();
  return (product?: AdminProductDetail, id?: string) => {
    const productId = product?.id ?? id;
    if (product) queryClient.setQueryData(productKey(product.id), product);
    else if (productId) void queryClient.invalidateQueries({ queryKey: productKey(productId) });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: DICTIONARIES_KEY });
    if (productId) void queryClient.invalidateQueries({ queryKey: ["movements", productId] });
  };
}

export function useProductMutations() {
  const invalidate = useProductInvalidation();
  return {
    create: useMutation({
      mutationFn: (input: AdminProductCreateInput) =>
        api<AdminProductDetail>("/admin/products", { method: "POST", body: input }),
      onSuccess: (product) => invalidate(product),
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<AdminProductInput> }) =>
        api<AdminProductDetail>(`/admin/products/${id}`, { method: "PATCH", body: input }),
      onSuccess: (product) => invalidate(product),
    }),
    saveVariants: useMutation({
      mutationFn: ({ id, input }: { id: string; input: AdminSaveVariantsInput }) =>
        api<AdminProductDetail>(`/admin/products/${id}/variants`, { method: "PUT", body: input }),
      onSuccess: (product) => invalidate(product),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/admin/products/${id}`, { method: "DELETE" }),
      onSuccess: () => invalidate(),
    }),
    adjustStock: useMutation({
      mutationFn: ({
        variantId,
        input,
      }: {
        productId: string;
        variantId: string;
        input: AdminStockAdjustInput;
      }) =>
        api<{ id: string; stock: number }>(`/admin/variants/${variantId}/stock`, {
          method: "PATCH",
          body: input,
        }),
      onSuccess: (_, { productId }) => invalidate(undefined, productId),
    }),
  };
}

export function useImageMutations(productId: string) {
  const queryClient = useQueryClient();
  const setImages = (images: AdminProductImage[]) => {
    queryClient.setQueryData<AdminProductDetail>(productKey(productId), (old) =>
      old ? { ...old, images } : old,
    );
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  };
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: productKey(productId) });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  };
  return {
    upload: useMutation({
      mutationFn: ({ files, colorId }: { files: File[]; colorId: string | null }) => {
        const form = new FormData();
        for (const file of files) form.append("files", file, file.name);
        if (colorId) form.append("colorId", colorId);
        return api<AdminProductImage[]>(`/admin/products/${productId}/images`, {
          method: "POST",
          form,
        });
      },
      onSuccess: setImages,
    }),
    reorder: useMutation({
      mutationFn: (ids: string[]) =>
        api<AdminProductImage[]>(`/admin/products/${productId}/images/order`, {
          method: "PATCH",
          body: { ids },
        }),
      onSuccess: setImages,
      onError: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: AdminImageUpdateInput }) =>
        api<AdminProductImage>(`/admin/images/${id}`, { method: "PATCH", body: input }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/admin/images/${id}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
  };
}
