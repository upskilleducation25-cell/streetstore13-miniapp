import type {
  AuthUser,
  BrandRef,
  CategoryItem,
  ColorRef,
  HomeResponse,
  Paginated,
  ProductCard,
  ProductDetail,
  SizeRef,
} from "@ss13/shared";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api } from "../../shared/api";
import { PAGE_SIZE } from "../../shared/config";
import { type CatalogFilters, filtersToApiQuery } from "./filters";

const HOUR = 60 * 60 * 1000;

export const useHome = () =>
  useQuery({
    queryKey: ["home"],
    queryFn: ({ signal }) => api.request<HomeResponse>("/home", { signal }),
  });

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => api.request<CategoryItem[]>("/categories", { signal }),
    staleTime: HOUR,
  });

export const useFilterOptions = () => {
  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: ({ signal }) => api.request<BrandRef[]>("/brands", { signal }),
    staleTime: HOUR,
  });
  const colors = useQuery({
    queryKey: ["colors"],
    queryFn: ({ signal }) => api.request<ColorRef[]>("/colors", { signal }),
    staleTime: HOUR,
  });
  const sizes = useQuery({
    queryKey: ["sizes"],
    queryFn: ({ signal }) => api.request<SizeRef[]>("/sizes", { signal }),
    staleTime: HOUR,
  });
  return { brands, colors, sizes };
};

export const useProducts = (filters: CatalogFilters) =>
  useInfiniteQuery({
    queryKey: ["products", filtersToApiQuery(filters)],
    queryFn: ({ pageParam, signal }) =>
      api.request<Paginated<ProductCard>>("/products", {
        query: { ...filtersToApiQuery(filters), limit: PAGE_SIZE, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

export const useSearch = (q: string) =>
  useInfiniteQuery({
    queryKey: ["search", q],
    queryFn: ({ pageParam, signal }) =>
      api.request<Paginated<ProductCard>>("/products/search", {
        query: { q, limit: PAGE_SIZE, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: q.length > 0,
  });

export const useProduct = (id: string) =>
  useQuery({
    queryKey: ["product", id],
    queryFn: ({ signal }) =>
      api.request<ProductDetail>(`/products/${encodeURIComponent(id)}`, { signal }),
  });

export const useMe = (enabled: boolean) =>
  useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => api.request<AuthUser>("/me", { auth: true, signal }),
    enabled,
    retry: false,
  });
