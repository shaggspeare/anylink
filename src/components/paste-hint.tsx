/** ⌘V is the main way links get in, so the hint shows up twice: quietly in the
 *  sidebar, and as a wide strip under the mosaic where the eye ends up. */
export function PasteHint({ wide = false }: { wide?: boolean }) {
  return (
    <div
      className={
        wide
          ? "mx-4 mb-10 hidden items-center justify-center gap-2.5 rounded-card border border-dashed border-ink/20 px-4 py-6 text-body text-ink/50 sm:mx-5 lg:mx-6.5 pointer-fine:flex"
          : "mt-2 hidden items-center gap-2 rounded-[14px] bg-ink/6 px-3 py-2.5 text-meta text-ink/50 pointer-fine:flex"
      }
    >
      <kbd
        className={`rounded-[7px] bg-white font-semibold text-ink/70 shadow-sm ${
          wide ? "px-2 py-1 text-[12px]" : "px-1.5 py-0.5 text-[10px]"
        }`}
      >
        ⌘V
      </kbd>
      paste anywhere to add a link
    </div>
  );
}
