"use client";

import { useMemo, useRef, useState } from "react";
import { AdminPageShell } from "@/components/AdminPageShell";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";

export type DashboardBannerItem = {
  id: string;
  image_url: string;
  link_url?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

const MAX_BANNERS = 3;
const RECOMMENDED_WIDTH = 1200;
const RECOMMENDED_HEIGHT = 432;
const RECOMMENDED_RATIO = RECOMMENDED_WIDTH / RECOMMENDED_HEIGHT;

function makeDraft(index: number): DashboardBannerItem {
  return {
    id: `draft-${Date.now()}-${index}`,
    image_url: "",
    link_url: "",
    sort_order: index,
    is_active: true,
  };
}

export default function DashboardBannerClient({
  initialBanners,
}: {
  initialBanners: DashboardBannerItem[];
}) {
  const [banners, setBanners] = useState<DashboardBannerItem[]>(
    initialBanners.slice(0, MAX_BANNERS),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const canAdd = banners.length < MAX_BANNERS;

  const previewBanners = useMemo(
    () => banners.filter((item) => item.image_url),
    [banners],
  );

  function flashSuccess(text: string) {
    setError(null);
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2600);
  }

  function flashError(text: string) {
    setMessage(null);
    setError(text);
  }

  function updateBanner(
    id: string,
    patch: Partial<DashboardBannerItem>,
  ) {
    setBanners((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }

  function addBanner() {
    if (!canAdd) return;
    setBanners((current) => [
      ...current,
      makeDraft(current.length),
    ]);
  }

  async function getImageDimensions(file: File) {
    return new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);

        image.onload = () => {
          const result = {
            width: image.naturalWidth,
            height: image.naturalHeight,
          };
          URL.revokeObjectURL(url);
          resolve(result);
        };

        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Could not read image dimensions."));
        };

        image.src = url;
      },
    );
  }

  async function uploadImage(
    banner: DashboardBannerItem,
    file: File,
  ) {
    if (!file.type.startsWith("image/")) {
      flashError("Please choose an image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      flashError("Image must be smaller than 8 MB.");
      return;
    }

    setUploadingId(banner.id);
    setError(null);
    setMessage(null);

    try {
      const { width, height } = await getImageDimensions(file);
      const ratio = width / height;
      const ratioDifference =
        Math.abs(ratio - RECOMMENDED_RATIO) /
        RECOMMENDED_RATIO;

      if (ratioDifference > 0.12) {
        flashError(
          `This image is ${width}×${height}px. For the best fit use ${RECOMMENDED_WIDTH}×${RECOMMENDED_HEIGHT}px (25:9 ratio).`,
        );
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "/api/admin/dashboard-banner/upload",
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        throw new Error(
          data.error || "Could not upload dashboard image.",
        );
      }

      updateBanner(banner.id, {
        image_url: data.url,
      });

      flashSuccess(
        `Image uploaded (${width}×${height}px). Save the card to publish it.`,
      );
    } catch (uploadError) {
      flashError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload image.",
      );
    } finally {
      setUploadingId(null);
    }
  }

  async function saveBanner(
    banner: DashboardBannerItem,
    index: number,
  ) {
    if (!banner.image_url) {
      flashError("Upload an image first.");
      return;
    }

    setSavingId(banner.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/dashboard-banner",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: banner.id.startsWith("draft-")
              ? null
              : banner.id,
            image_url: banner.image_url,
            link_url:
              String(banner.link_url || "").trim() || null,
            sort_order: index,
            is_active: banner.is_active,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.banner) {
        throw new Error(
          data.error || "Could not save dashboard card.",
        );
      }

      setBanners((current) =>
        current.map((item) =>
          item.id === banner.id
            ? data.banner
            : item,
        ),
      );

      flashSuccess("Dashboard card saved.");
    } catch (saveError) {
      flashError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save card.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function removeBanner(
    banner: DashboardBannerItem,
  ) {
    if (banner.id.startsWith("draft-")) {
      setBanners((current) =>
        current
          .filter((item) => item.id !== banner.id)
          .map((item, index) => ({
            ...item,
            sort_order: index,
          })),
      );
      return;
    }

    if (!window.confirm("Remove this dashboard card?")) {
      return;
    }

    setDeletingId(banner.id);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/dashboard-banner?id=${encodeURIComponent(
          banner.id,
        )}`,
        { method: "DELETE" },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Could not remove dashboard card.",
        );
      }

      setBanners((current) =>
        current
          .filter((item) => item.id !== banner.id)
          .map((item, index) => ({
            ...item,
            sort_order: index,
          })),
      );

      flashSuccess("Dashboard card removed.");
    } catch (deleteError) {
      flashError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove card.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function moveBanner(
    index: number,
    direction: -1 | 1,
  ) {
    const target = index + direction;
    if (target < 0 || target >= banners.length) return;

    const next = [...banners];
    [next[index], next[target]] = [
      next[target],
      next[index],
    ];

    const ordered = next.map((item, nextIndex) => ({
      ...item,
      sort_order: nextIndex,
    }));

    setBanners(ordered);

    const saved = ordered.filter(
      (item) => !item.id.startsWith("draft-"),
    );

    await Promise.all(
      saved.map((item) =>
        fetch("/api/admin/dashboard-banner", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(item),
        }),
      ),
    );
  }

  return (
    <AdminPageShell active="dashboard-banner">
      <div className="min-h-screen px-4 py-5 lg:px-0 lg:py-0">
        <AdminMobileHeader />

        <div className="mx-auto w-full max-w-6xl">
          <header className="mb-5 rounded-[28px] bg-white/10 px-5 py-5 backdrop-blur-2xl lg:px-7 lg:py-6">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
              Client Dashboard
            </div>

            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[30px] font-black tracking-[-0.04em] text-white">
                  Dashboard Cards
                </h1>
                <p className="mt-2 max-w-2xl text-[12px] font-bold leading-5 text-white/65">
                  Upload the finished artwork. Up to three cards can rotate on the client dashboard.
                </p>
              </div>

              <button
                type="button"
                onClick={addBanner}
                disabled={!canAdd}
                className="h-11 rounded-full bg-[#ffd66b] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#365665] disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add Card
              </button>
            </div>
          </header>

          {error ? (
            <div className="mb-4 rounded-[18px] bg-red-500/20 px-4 py-3 text-[12px] font-black text-red-100">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mb-4 rounded-[18px] bg-emerald-500/20 px-4 py-3 text-[12px] font-black text-emerald-100">
              {message}
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <section className="space-y-4">
              {banners.length === 0 ? (
                <div className="rounded-[28px] bg-white/10 p-7 text-center backdrop-blur-2xl">
                  <div className="text-[16px] font-black text-white">
                    No dashboard cards yet
                  </div>
                  <p className="mt-2 text-[12px] font-bold text-white/55">
                    Add your first card and upload the finished artwork.
                  </p>
                  <button
                    type="button"
                    onClick={addBanner}
                    className="mt-5 h-11 rounded-full bg-[#ffd66b] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#365665]"
                  >
                    + Add Card
                  </button>
                </div>
              ) : null}

              {banners.map((banner, index) => (
                <article
                  key={banner.id}
                  className="rounded-[28px] bg-white/10 p-5 backdrop-blur-2xl lg:p-6"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ffd66b]">
                        Card {index + 1}
                      </div>
                      <div className="mt-1 text-[12px] font-bold text-white/55">
                        Position {index + 1} of {banners.length}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void moveBanner(index, -1)}
                        disabled={index === 0}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-25"
                        aria-label="Move card left"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveBanner(index, 1)}
                        disabled={index === banners.length - 1}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-25"
                        aria-label="Move card right"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeBanner(banner)}
                        disabled={deletingId === banner.id}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-400/85 text-[16px] font-black text-white disabled:opacity-50"
                        aria-label="Delete card"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div
                    className="relative overflow-hidden rounded-[18px] border border-white/15 bg-black/10"
                    style={{ aspectRatio: "25 / 9" }}
                  >
                    {banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={`Card ${index + 1} preview`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[150px] items-center justify-center px-5 text-center">
                        <div>
                          <div className="text-[13px] font-black text-white/70">
                            Upload card artwork
                          </div>
                          <div className="mt-1 text-[10px] font-bold text-white/45">
                            Your text should already be inside the image.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    ref={(element) => {
                      fileInputs.current[banner.id] = element;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void uploadImage(banner, file);
                      }
                      event.currentTarget.value = "";
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      fileInputs.current[banner.id]?.click()
                    }
                    disabled={uploadingId === banner.id}
                    className="mt-4 h-12 w-full rounded-[16px] bg-white px-4 text-[12px] font-black text-[#365665] disabled:opacity-55"
                  >
                    {uploadingId === banner.id
                      ? "Uploading..."
                      : banner.image_url
                        ? "Replace Image"
                        : "Upload Image"}
                  </button>

                  <div className="mt-2 rounded-[14px] bg-white/8 px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#ffd66b]">
                      Recommended image size
                    </div>
                    <div className="mt-1 text-[12px] font-black text-white">
                      1200 × 432 px
                    </div>
                    <div className="mt-1 text-[10px] font-bold leading-4 text-white/52">
                      Ratio 25:9. PNG, JPG or WebP. Maximum 8 MB. This ratio matches the client card and prevents important artwork from being cropped.
                    </div>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-white/65">
                      Card hyperlink
                    </span>
                    <input
                      value={banner.link_url || ""}
                      onChange={(event) =>
                        updateBanner(banner.id, {
                          link_url: event.target.value,
                        })
                      }
                      placeholder="https://... or /page"
                      className="h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
                    />
                  </label>

                  <div className="mt-4 flex items-center justify-between gap-4 rounded-[16px] bg-white/8 px-4 py-3">
                    <div>
                      <div className="text-[11px] font-black text-white">
                        Active
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-white/45">
                        Disabled cards do not appear to clients.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={banner.is_active}
                      onChange={(event) =>
                        updateBanner(banner.id, {
                          is_active: event.target.checked,
                        })
                      }
                      className="h-5 w-5"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveBanner(banner, index)}
                    disabled={
                      savingId === banner.id ||
                      !banner.image_url
                    }
                    className="mt-4 h-12 w-full rounded-full bg-[#ffd66b] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#365665] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {savingId === banner.id
                      ? "Saving..."
                      : "Save Card"}
                  </button>
                </article>
              ))}
            </section>

            <aside className="rounded-[28px] bg-white/10 p-5 backdrop-blur-2xl lg:sticky lg:top-6 lg:h-fit lg:p-6">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-white/65">
                Client preview
              </div>

              {previewBanners.length > 0 ? (
                <>
                  <div
                    className="mt-4 overflow-hidden rounded-[18px] border border-white/15"
                    style={{ aspectRatio: "25 / 9" }}
                  >
                    <img
                      src={previewBanners[0].image_url}
                      alt="Dashboard card preview"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {previewBanners.length > 1 ? (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {previewBanners.map((banner, index) => (
                        <span
                          key={banner.id}
                          className={`h-2.5 rounded-full ${
                            index === 0
                              ? "w-6 bg-[#ffd66b]"
                              : "w-2.5 bg-white/45"
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-4 flex min-h-[150px] items-center justify-center rounded-[18px] border border-white/10 bg-white/5 px-5 text-center text-[12px] font-bold text-white/45">
                  Your uploaded cards will preview here.
                </div>
              )}

              <div className="mt-5 rounded-[18px] bg-white/8 p-4 text-[11px] font-bold leading-5 text-white/55">
                The client dashboard automatically rotates active cards every 5 seconds. Clients can also tap the dots to switch cards. Maximum: 3 cards.
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
