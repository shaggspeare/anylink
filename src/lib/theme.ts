export type Theme = "system" | "light" | "dark";

/** localStorage key, read before first paint by the script in app/layout.tsx. */
export const THEME_KEY = "theme";

/** Sets the `dark` class and the browser chrome colour for `theme`. */
export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  // Browser chrome (status bar, Android toolbar) follows the canvas, not the OS setting.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f1012" : "#eceef0");
}
