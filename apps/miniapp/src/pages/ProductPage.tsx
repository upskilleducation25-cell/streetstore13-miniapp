import { formatUah, type ProductDetail } from "@ss13/shared";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

import { PageHeader } from "../app/PageHeader";
import { useProduct } from "../entities/product/api";
import {
  clampQuantity,
  findVariant,
  imagesForColor,
  initialSelection,
  selectColor,
  selectSize,
  type Selection,
  showLowStock,
  sizeOptions,
} from "../entities/product/options";
import { ProductBadge } from "../entities/product/ui/Badges";
import { PriceTag } from "../entities/product/ui/PriceTag";
import { cartStore, useCartLines } from "../features/cart/cart";
import { quantityInCart } from "../features/cart/cart-store";
import { CartButton } from "../features/cart/CartButton";
import { ColorPicker } from "../features/product-options/ColorPicker";
import { ProductGallery } from "../features/product-options/ProductGallery";
import { QuantityStepper } from "../features/product-options/QuantityStepper";
import { SizePicker } from "../features/product-options/SizePicker";
import { LOW_STOCK_THRESHOLD } from "../shared/config";
import { t } from "../shared/strings";
import { MainButton } from "../shared/telegram/MainButton";
import { haptic } from "../shared/telegram/telegram";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/States";
import { showToast } from "../shared/ui/Toast";

function ProductSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="px-4">
        <Skeleton className="mt-5 h-3 w-24" />
        <Skeleton className="mt-3 h-5 w-3/4" />
        <Skeleton className="mt-4 h-6 w-28" />
        <Skeleton className="mt-8 h-11 w-2/3" />
        <Skeleton className="mt-6 h-11 w-full" />
      </div>
    </div>
  );
}

function ProductView({ product }: { product: ProductDetail }) {
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product));
  const [quantity, setQuantity] = useState(1);
  const lines = useCartLines();

  const sizes = useMemo(() => sizeOptions(product, selection.color), [product, selection.color]);
  const images = useMemo(
    () => imagesForColor(product, selection.color),
    [product, selection.color],
  );
  const variant = findVariant(product, selection.color, selection.size);
  const inCart = variant ? quantityInCart(lines, variant.id) : 0;
  const maxToAdd = variant ? Math.max(0, variant.stock - inCart) : 0;
  const qty = clampQuantity(quantity, maxToAdd);
  const color = product.colors.find((c) => c.slug === selection.color);

  const buttonText = !product.inStock
    ? t.product.outOfStock
    : !variant
      ? t.product.chooseSize
      : maxToAdd < 1
        ? t.product.maxInCart
        : `${t.product.addToCart} · ${formatUah(variant.price * qty)}`;

  const addToCart = () => {
    if (!variant || maxToAdd < 1 || !color) return;
    const added = cartStore.add({
      variantId: variant.id,
      productId: product.id,
      name: product.name,
      brand: product.brand.name,
      colorName: color.name,
      sizeLabel: variant.sizeLabel,
      price: variant.price,
      image: images[0]?.urls.thumb ?? images[0]?.urls.medium ?? null,
      quantity: qty,
      maxQuantity: variant.stock,
    });
    if (added > 0) {
      haptic.success();
      showToast(t.product.added);
      setQuantity(1);
    } else {
      haptic.error();
      showToast(t.product.maxInCart);
    }
  };

  return (
    <>
      <div className="relative">
        <ProductGallery images={images} alt={`${product.brand.name} ${product.name}`} />
        <ProductBadge product={product} />
      </div>

      <div className="px-4">
        <p className="mt-5 text-xs uppercase tracking-[0.14em] text-hint">{product.brand.name}</p>
        <h1 className="mt-1.5 text-xl leading-snug font-medium tracking-tight">{product.name}</h1>
        <div className="mt-3">
          <PriceTag product={variant ? { ...product, price: variant.price } : product} size="lg" />
        </div>
        <p className="mt-2 text-xs text-hint">
          {t.product.sku}: {product.sku}
        </p>

        <div className="mt-7 space-y-6">
          <ColorPicker
            colors={product.colors}
            value={selection.color}
            onChange={(slug) => setSelection((s) => selectColor(product, s, slug))}
          />
          <SizePicker
            sizes={sizes}
            value={selection.size}
            onChange={(label) => setSelection((s) => selectSize(product, s, label))}
          />
          {variant && showLowStock(variant.stock, LOW_STOCK_THRESHOLD) && (
            <p className="text-sm text-sale">{t.product.lowStock(variant.stock)}</p>
          )}
          <QuantityStepper
            value={qty}
            max={maxToAdd}
            onChange={(next) => setQuantity(clampQuantity(next, maxToAdd))}
          />
        </div>

        {(product.description || product.material) && (
          <div className="mt-9 space-y-5 border-t border-line pt-6 text-sm leading-relaxed">
            {product.description && (
              <section>
                <h2 className="mb-2 text-xs uppercase tracking-[0.12em] text-hint">
                  {t.product.description}
                </h2>
                <p className="whitespace-pre-line">{product.description}</p>
              </section>
            )}
            {product.material && (
              <section>
                <h2 className="mb-2 text-xs uppercase tracking-[0.12em] text-hint">
                  {t.product.material}
                </h2>
                <p>{product.material}</p>
              </section>
            )}
          </div>
        )}
      </div>

      <MainButton text={buttonText} disabled={!variant || maxToAdd < 1} onClick={addToCart} />
    </>
  );
}

export default function ProductPage() {
  const { id = "" } = useParams();
  const product = useProduct(id);

  return (
    <>
      <PageHeader right={<CartButton />} />
      {product.isPending ? (
        <ProductSkeleton />
      ) : product.isError ? (
        <ErrorState error={product.error} onRetry={() => void product.refetch()} />
      ) : (
        <ProductView key={product.data.id} product={product.data} />
      )}
    </>
  );
}
