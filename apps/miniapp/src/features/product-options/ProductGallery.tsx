import type { ProductImage } from "@ss13/shared";
import { useEffect, useRef, useState } from "react";

import { t } from "../../shared/strings";
import { Image } from "../../shared/ui/Image";

/** Галерея зі свайпом (scroll-snap) і крапками-індикаторами. */
export function ProductGallery({ images, alt }: { images: ProductImage[]; alt: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const key = images.map((image) => image.id).join();

  // Новий колір — нові фото: повертаємося до першого.
  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
    setIndex(0);
  }, [key]);

  if (images.length === 0) return <Image urls={null} alt={alt} eager />;

  return (
    <div className="relative">
      <ul
        ref={track}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        aria-label={alt}
        onScroll={(event) => {
          const el = event.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
        }}
      >
        {images.map((image, i) => (
          <li
            key={image.id}
            className="w-full shrink-0 snap-center"
            aria-label={t.product.photo(i + 1, images.length)}
          >
            <Image urls={image.urls} alt={image.alt ?? alt} eager={i === 0} sizes="100vw" />
          </li>
        ))}
      </ul>
      {images.length > 1 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5"
          aria-hidden="true"
        >
          {images.map((image, i) => (
            <span
              key={image.id}
              className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-fg" : "bg-fg/25"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
