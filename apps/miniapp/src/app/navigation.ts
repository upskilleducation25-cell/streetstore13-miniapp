import { useCallback } from "react";
import { useNavigate } from "react-router";

/** «Назад» в історії застосунку; якщо сторінку відкрито напряму — на головну. */
export function useGoBack(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate]);
}
