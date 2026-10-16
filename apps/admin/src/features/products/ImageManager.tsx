import type { AdminColor, AdminProductImage } from "@ss13/shared";
import { IMAGE_UPLOAD_LIMITS } from "@ss13/shared";
import { useEffect, useRef, useState } from "react";

import { errorMessage } from "../../shared/api";
import { Button } from "../../shared/ui/Button";
import { useConfirm } from "../../shared/ui/Dialog";
import { Field, Select } from "../../shared/ui/Field";
import { useToast } from "../../shared/ui/Toast";
import { Thumb } from "../../shared/ui/Thumb";
import { useImageMutations } from "./api";

const ACCEPTED = IMAGE_UPLOAD_LIMITS.accept.split(",");
const MAX_MB = IMAGE_UPLOAD_LIMITS.maxFileBytes / 1024 / 1024;

/** Попередня перевірка в браузері; сервер однаково перевіряє вміст файлу. */
export function checkFile(file: { name: string; size: number; type: string }): string | null {
  if (file.size > IMAGE_UPLOAD_LIMITS.maxFileBytes) return `«${file.name}»: більше ${MAX_MB} МБ`;
  if (file.type && !ACCEPTED.includes(file.type) && !/\.(heic|heif)$/i.test(file.name)) {
    return `«${file.name}»: підтримуються JPEG, PNG, WebP, AVIF, HEIC`;
  }
  return null;
}

function Previews({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  // URL створюємо в ефекті: тоді очищення (і подвійний запуск у StrictMode) не лишає «мертвих» посилань.
  useEffect(() => {
    const created = files.map((file) => URL.createObjectURL(file));
    setUrls(created);
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`} className="relative">
          <div className="relative aspect-[3/4] overflow-hidden bg-soft">
            {urls[index] && (
              <img
                src={urls[index]}
                alt={file.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Прибрати ${file.name}`}
            className="absolute top-1 right-1 bg-panel/90 px-1.5 text-sm"
          >
            ×
          </button>
          <p className="mt-1 truncate text-[11px] text-muted">{file.name}</p>
        </li>
      ))}
    </ul>
  );
}

export function ImageManager({
  productId,
  images,
  colors,
}: {
  productId: string;
  images: AdminProductImage[];
  colors: AdminColor[];
}) {
  const mutations = useImageMutations(productId);
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [colorId, setColorId] = useState("");
  const colorById = new Map(colors.map((c) => [c.id, c]));
  const room = IMAGE_UPLOAD_LIMITS.maxImagesPerProduct - images.length;

  const pick = (list: FileList | null) => {
    const files = [...(list ?? [])];
    const errors = files.map(checkFile).filter((error): error is string => error !== null);
    const ok = files.filter((file) => checkFile(file) === null);
    const next = [...pending, ...ok].slice(
      0,
      Math.min(IMAGE_UPLOAD_LIMITS.maxFilesPerRequest, room),
    );
    if (pending.length + ok.length > next.length) {
      errors.push(
        `За раз — до ${IMAGE_UPLOAD_LIMITS.maxFilesPerRequest} фото, всього — до ${IMAGE_UPLOAD_LIMITS.maxImagesPerProduct}`,
      );
    }
    setProblems(errors);
    setPending(next);
    if (input.current) input.current.value = "";
  };

  const upload = () =>
    mutations.upload.mutate(
      { files: pending, colorId: colorId || null },
      {
        onSuccess: () => {
          toast(pending.length === 1 ? "Фото завантажено" : `Завантажено фото: ${pending.length}`);
          setPending([]);
          setProblems([]);
        },
        onError: (error) => toast(errorMessage(error), "error"),
      },
    );

  const move = (index: number, delta: number) => {
    const ids = images.map((image) => image.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    mutations.reorder.mutate(ids, { onError: (error) => toast(errorMessage(error), "error") });
  };

  const remove = async (image: AdminProductImage, index: number) => {
    const ok = await confirm({
      title: "Видалити фото?",
      message:
        index === 0
          ? "Це головне фото товару. Головним стане наступне."
          : "Фото зникне з товару на вітрині.",
      confirmLabel: "Видалити",
      danger: true,
    });
    if (!ok) return;
    mutations.remove.mutate(image.id, {
      onSuccess: () => toast("Фото видалено"),
      onError: (error) => toast(errorMessage(error), "error"),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {images.length === 0 ? (
        <p className="text-sm text-muted">Фото ще немає. Перше фото буде головним у каталозі.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((image, index) => (
            <li key={image.id} className="flex flex-col gap-1.5 border border-line p-2">
              <div className="relative">
                <Thumb urls={image.urls} alt={image.alt ?? ""} className="w-full" />
                {index === 0 && (
                  <span className="absolute top-1 left-1 bg-fg px-1.5 py-0.5 text-[10px] text-bg uppercase">
                    Головне
                  </span>
                )}
              </div>
              <Select
                aria-label="Колір фото"
                value={image.colorId ?? ""}
                onChange={(event) =>
                  mutations.update.mutate(
                    { id: image.id, input: { colorId: event.target.value || null } },
                    { onError: (error) => toast(errorMessage(error), "error") },
                  )
                }
                className="min-h-8 py-1 text-xs"
              >
                <option value="">Для всіх кольорів</option>
                {colors.map((color) => (
                  <option key={color.id} value={color.id}>
                    {color.name}
                  </option>
                ))}
              </Select>
              <div className="flex items-center justify-between text-xs">
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === 0 || mutations.reorder.isPending}
                    onClick={() => move(index, -1)}
                    aria-label="Перемістити ліворуч"
                  >
                    ←
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === images.length - 1 || mutations.reorder.isPending}
                    onClick={() => move(index, 1)}
                    aria-label="Перемістити праворуч"
                  >
                    →
                  </Button>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => void remove(image, index)}
                >
                  Видалити
                </Button>
              </div>
              {image.colorId && (
                <p className="truncate text-[11px] text-muted">
                  {colorById.get(image.colorId)?.name}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border border-dashed border-line p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            multiple
            accept={IMAGE_UPLOAD_LIMITS.accept + ",.heic,.heif"}
            onChange={(event) => pick(event.target.files)}
            className="sr-only"
            id={`upload-${productId}`}
            disabled={room <= 0}
          />
          <label
            htmlFor={`upload-${productId}`}
            className={`inline-flex min-h-10 cursor-pointer items-center border border-line bg-panel px-4 text-sm hover:border-fg ${room <= 0 ? "pointer-events-none opacity-50" : ""}`}
          >
            Обрати фото…
          </label>
          <span className="text-xs text-muted">
            JPEG, PNG, WebP, AVIF, HEIC · до {MAX_MB} МБ · до{" "}
            {IMAGE_UPLOAD_LIMITS.maxFilesPerRequest} за раз
          </span>
        </div>
        {problems.length > 0 && (
          <ul role="alert" className="text-xs text-danger">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <>
            <p className="text-sm">Перегляд перед завантаженням ({pending.length}):</p>
            <Previews
              files={pending}
              onRemove={(index) => setPending(pending.filter((_, i) => i !== index))}
            />
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Колір для цих фото" className="min-w-48">
                {(props) => (
                  <Select
                    {...props}
                    value={colorId}
                    onChange={(event) => setColorId(event.target.value)}
                  >
                    <option value="">Для всіх кольорів</option>
                    {colors.map((color) => (
                      <option key={color.id} value={color.id}>
                        {color.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button variant="primary" loading={mutations.upload.isPending} onClick={upload}>
                Завантажити
              </Button>
              <Button disabled={mutations.upload.isPending} onClick={() => setPending([])}>
                Скасувати
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
