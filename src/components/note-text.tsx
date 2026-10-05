import { linkify } from "@/lib/linkify";

/** Plain note text with its links made clickable — no markdown, whitespace kept as typed.
 * Link clicks don't bubble: on a card, the card itself opens the note. */
export function NoteText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${className}`}>
      {linkify(text).map((part, i) =>
        part.href ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="text-signal underline decoration-signal/35 underline-offset-[3px] transition-colors hover:decoration-signal"
          >
            {part.text}
          </a>
        ) : (
          part.text
        )
      )}
    </span>
  );
}
