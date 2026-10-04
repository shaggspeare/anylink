"use client";

import { useEffect } from "react";
import { useLocalSetting } from "@/lib/use-local-setting";
import { applyTheme, THEME_KEY, type Theme } from "@/lib/theme";

/** Flips between light and dark (leaving System, if that was on) and remembers the choice.
 * While System is on, it also follows the OS switching mid-session. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useLocalSetting<Theme>(THEME_KEY, "light");

  useEffect(() => {
    if (theme !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [theme]);

  function toggle() {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  // Both icons render; CSS picks one, so server and client markup match.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={`flex h-11 w-11 flex-none lg:h-9 lg:w-9 items-center justify-center rounded-full text-ink/60 hover:bg-ink/6 hover:text-ink ${className}`}
    >
      <svg className="dark:hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg className="hidden dark:block" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
