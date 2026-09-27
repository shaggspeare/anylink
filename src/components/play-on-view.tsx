"use client";

import { useEffect, useRef } from "react";

/** A one-shot video that waits until it's scrolled into view — autoplay alone would
 *  finish long before anyone reaches the bottom of the page. */
export function PlayOnView(props: React.VideoHTMLAttributes<HTMLVideoElement>) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        video.play().catch(() => {});
        observer.disconnect();
      },
      { threshold: 0.5 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return <video ref={ref} muted playsInline preload="auto" {...props} />;
}
