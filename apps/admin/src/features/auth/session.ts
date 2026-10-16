import type { AdminLoginInput, AdminSessionResponse } from "@ss13/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError, setCsrfToken } from "../../shared/api";

export const SESSION_KEY = ["session"] as const;

/** Поточна сесія адміна; null — не увійшов (401). */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async (): Promise<AdminSessionResponse | null> => {
      try {
        const session = await api<AdminSessionResponse>("/admin/auth/me");
        setCsrfToken(session.csrfToken);
        return session;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setCsrfToken(null);
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminLoginInput) =>
      api<AdminSessionResponse>("/admin/auth/login", { method: "POST", body: input }),
    onSuccess: (session) => {
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(SESSION_KEY, session);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/admin/auth/logout", { method: "POST" }),
    onSettled: () => {
      setCsrfToken(null);
      queryClient.clear();
      queryClient.setQueryData(SESSION_KEY, null);
    },
  });
}
