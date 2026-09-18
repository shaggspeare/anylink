"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useLibrary } from "@/lib/store";
import { TOUR_STEPS, type TourPage, type TourStep } from "@/lib/tour";

const STORAGE_KEY = "anylink:tour";
const TOUR_EVENT = "anylink:tour-start";

/** The button lives in the sidebar, the runner in the root layout (it has to survive
 * the navigations the tour itself makes) — a window event is the whole wiring. */
export function TourButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}
      className="flex w-full items-center gap-2.5 rounded-[14px] bg-ink px-3 py-2.5 text-body font-semibold text-[#f4f5f6]"
    >
      <span className="flex h-4 w-4 items-center justify-center text-[10px] leading-none">▶</span>
      Guided tour
    </button>
  );
}

type ResolvedStep = TourStep & { href: string };

export function TourRunner() {
  const { links, trashed, collections } = useLibrary();
  const pathname = usePathname();
  const router = useRouter();
  const driverRef = useRef<Driver | null>(null);

  // Pages the demo can actually visit right now: a collection that has links, an
  // article, a product, a non-empty trash. Steps for the rest are dropped.
  const steps = useMemo<ResolvedStep[]>(() => {
    const collection = collections.find(
      (c) => !c.isSmart && links.some((l) => l.collectionId === c.id)
    );
    const article = links.find((l) => l.contentType !== "product");
    const product = links.find((l) => l.contentType === "product");
    const hrefs: Record<TourPage, string | null> = {
      library: "/",
      collection: collection ? `/collections/${collection.id}` : null,
      link: article ? `/links/${article.id}` : null,
      product: product ? `/links/${product.id}` : null,
      trash: trashed.length > 0 ? "/trash" : null,
    };
    return TOUR_STEPS.flatMap((step) => {
      const href = hrefs[step.page];
      return href ? [{ ...step, href }] : [];
    });
  }, [links, trashed, collections]);

  // A driver instance belongs to the page it was built for.
  useEffect(
    () => () => {
      driverRef.current?.destroy();
      driverRef.current = null;
    },
    [pathname]
  );

  useEffect(() => {
    if (steps.length === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const goTo = (index: number) => {
      if (index >= steps.length) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, String(index));
      if (steps[index].href === pathname) runFrom(index);
      else router.push(steps[index].href);
    };

    const onScreen = (selector?: string) => {
      if (!selector) return true;
      const el = document.querySelector(selector);
      // getClientRects() also catches the sidebar collapsing on small screens.
      return Boolean(el && el.getClientRects().length > 0);
    };

    const runFrom = (index: number) => {
      let end = index;
      while (end < steps.length && steps[end].href === pathname) end++;

      const slice = steps
        .slice(index, end)
        .map((step, offset) => ({ step, index: index + offset }))
        .filter(({ step }) => onScreen(step.element));

      // Nothing to point at on this page — skip ahead rather than dead-end.
      if (slice.length === 0) return goTo(end);

      const hasMore = end < steps.length;

      // Referenced by the callbacks below, which only ever run after drive().
      const instance: Driver = driver({
        showProgress: true,
        progressText: `{{current}} of ${slice.length}`,
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: hasMore ? "Continue →" : "Done",
        popoverClass: "anylink-tour",
        steps: slice.map(({ step }, i) => ({
          element: step.element,
          popover: {
            title: step.title,
            description: step.description,
            side: step.side ?? "bottom",
            align: step.align ?? "center",
            // Only on the last step of a page, where Next hands over to the next page:
            // driver.js spreads this object over its own defaults, so even an
            // `onNextClick: undefined` here would delete its built-in next handler.
            ...(i === slice.length - 1 && hasMore
              ? {
                  onNextClick: () => {
                    instance.destroy();
                    goTo(end);
                  },
                }
              : {}),
          },
        })),
        onHighlightStarted: (el, _step, options) => {
          // driver.js sometimes leaves its highlight class on the previous element
          // (and on the dummy it makes for element-less steps), which then sits lit
          // above the overlay for the rest of the tour. One element at a time:
          document.querySelectorAll(".driver-active-element").forEach((node) => {
            if (node !== el) node.classList.remove("driver-active-element");
          });
          const current = slice[options.state.activeIndex ?? 0];
          if (current) sessionStorage.setItem(STORAGE_KEY, String(current.index));
        },
        onDestroyStarted: () => {
          sessionStorage.removeItem(STORAGE_KEY);
          instance.destroy();
        },
      });

      driverRef.current = instance;
      instance.drive();
    };

    const onStart = () => {
      driverRef.current?.destroy();
      goTo(0);
    };
    window.addEventListener(TOUR_EVENT, onStart);

    // Resume after the tour navigated here, once this page has rendered its cards.
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved !== null && !driverRef.current?.isActive()) {
      timer = setTimeout(() => runFrom(Number(saved)), 250);
    }

    return () => {
      window.removeEventListener(TOUR_EVENT, onStart);
      clearTimeout(timer);
    };
  }, [pathname, steps, router]);

  return null;
}
