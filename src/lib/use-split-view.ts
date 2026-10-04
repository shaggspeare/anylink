"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** From here up there's room for sidebar + grid + an open link side by side. */
export const SPLIT_MIN_PX = 1280;
export const PANE_PX = 520;
const QUERY = `(min-width: ${SPLIT_MIN_PX}px)`;

/** Desktop three-pane view: the open link lives in `?open=<id>`, so it survives a reload
 * and keeps any `?q=` filter. Below SPLIT_MIN_PX it's ignored and cards open full-page. */
export function useSplitView() {
  const wide = useSyncExternalStore(
    (notify) => {
      const query = matchMedia(QUERY);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => matchMedia(QUERY).matches,
    () => false
  );
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // replace, not push: browsing ten links shouldn't take ten Backs to leave the page.
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("open", id);
    else next.delete("open");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return {
    wide,
    openId: wide ? params.get("open") : null,
    open: (id: string) => setOpen(id),
    close: () => setOpen(null),
  };
}

export type SplitView = ReturnType<typeof useSplitView>;
