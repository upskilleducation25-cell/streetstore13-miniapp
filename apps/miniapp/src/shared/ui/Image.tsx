import type { ImageUrls } from "@ss13/shared";
import { useState } from "react";

const WIDTHS: Array<[keyof ImageUrls, number]> = [
  ["thumb", 300],
  ["medium", 600],
  ["large", 1200],
];

/** srcset з версій thumb/medium/large; однакові URL (demo-плейсхолдери) не дублюються. */
export function buildSrcSet(urls: ImageUrls): {
  src: string | undefined;
  srcSet: string | undefined;
} {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const [key, width] of WIDTHS) {
    const url = urls[key];
    if (url && !seen.has(url)) {
      seen.add(url);
      parts.push(`${url} ${width}w`);
    }
  }
  return {
    src: urls.medium ?? urls.large ?? urls.thumb,
    srcSet: parts.length > 1 ? parts.join(", ") : undefined,
  };
}

interface ImageProps {
  urls: ImageUrls | null;
  alt: string;
  /** Фото на першому екрані завантажуються одразу, решта — ліниво. */
  eager?: boolean;
  sizes?: string;
  className?: string;
}

/** Фото з фіксованою пропорцією 3:4: макет не стрибає, поки фото вантажиться. */
export function Image({ urls, alt, eager = false, sizes = "50vw", className = "" }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const { src, srcSet } = urls ? buildSrcSet(urls) : { src: undefined, srcSet: undefined };
  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden bg-surface ${className}`}>
      {src ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt={alt}
          width={600}
          height={800}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs tracking-[0.2em] text-hint">
          STREETSTORE.13
        </div>
      )}
    </div>
  );
}
