import type { ImageUrls } from "@ss13/shared";
import { useState } from "react";

/** Мініатюра 3:4; якщо фото недоступне (напр. demo-плейсхолдер Mini App) — нейтральна заглушка. */
export function Thumb({
  urls,
  alt,
  className = "w-12",
}: {
  urls: ImageUrls | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = urls?.thumb ?? urls?.medium ?? urls?.large;
  return (
    <div className={`relative aspect-[3/4] shrink-0 overflow-hidden bg-soft ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[9px] tracking-widest text-muted">
          SS13
        </span>
      )}
    </div>
  );
}
