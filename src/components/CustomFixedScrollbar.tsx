import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

type CustomScrollbarProps = {
  targetRef: React.RefObject<HTMLElement>;
  watch?: unknown;
};

export function CustomFixedScrollbar({ targetRef, watch }: CustomScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [trackLeft, setTrackLeft] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [thumbLeft, setThumbLeft] = useState(0);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScroll = useRef(0);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;

    const hasOverflow = el.scrollWidth - el.clientWidth > 1;
    setVisible(hasOverflow);
    if (!hasOverflow) return;

    const rect = el.getBoundingClientRect();
    setTrackLeft(rect.left);
    setTrackWidth(rect.width);

    const ratio = el.clientWidth / el.scrollWidth;
    const tw = Math.max(40, rect.width * ratio);
    setThumbWidth(tw);

    const scrollRatio = el.scrollLeft / (el.scrollWidth - el.clientWidth);
    setThumbLeft(scrollRatio * (rect.width - tw));
  }, [targetRef]);

  // Measure on mount, resize, scroll, and watch changes
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    measure();

    const onScroll = () => {
      if (dragging.current) return;
      const hasOverflow = el.scrollWidth - el.clientWidth > 1;
      if (!hasOverflow) { setVisible(false); return; }

      const rect = el.getBoundingClientRect();
      const ratio = el.clientWidth / el.scrollWidth;
      const tw = Math.max(40, rect.width * ratio);
      const scrollRatio = el.scrollLeft / (el.scrollWidth - el.clientWidth);

      setTrackLeft(rect.left);
      setTrackWidth(rect.width);
      setThumbWidth(tw);
      setThumbLeft(scrollRatio * (rect.width - tw));
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    window.addEventListener("resize", measure, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [targetRef, watch, measure]);

  // Drag handling
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const el = targetRef.current;
      if (!el) return;

      const delta = e.clientX - dragStartX.current;
      const maxThumbOffset = trackWidth - thumbWidth;
      if (maxThumbOffset <= 0) return;

      const newThumbLeft = Math.max(0, Math.min(maxThumbOffset, thumbLeft + delta));
      const scrollRatio = newThumbLeft / maxThumbOffset;
      el.scrollLeft = scrollRatio * (el.scrollWidth - el.clientWidth);

      dragStartX.current = e.clientX;
      setThumbLeft(newThumbLeft);
    };

    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [targetRef, trackWidth, thumbWidth, thumbLeft]);

  const onThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartScroll.current = targetRef.current?.scrollLeft ?? 0;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  const onTrackClick = (e: React.MouseEvent) => {
    const el = targetRef.current;
    if (!el || !trackRef.current) return;

    const trackRect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    const maxThumbOffset = trackWidth - thumbWidth;
    if (maxThumbOffset <= 0) return;

    const newThumbLeft = Math.max(0, Math.min(maxThumbOffset, clickX - thumbWidth / 2));
    const scrollRatio = newThumbLeft / maxThumbOffset;
    el.scrollLeft = scrollRatio * (el.scrollWidth - el.clientWidth);
  };

  if (!visible) return null;

  return createPortal(
    <div
      ref={trackRef}
      onClick={onTrackClick}
      style={{
        position: "fixed",
        bottom: 0,
        left: trackLeft,
        width: trackWidth,
        height: 14,
        zIndex: 9999,
        background: "hsl(var(--muted))",
        borderTop: "1px solid hsl(var(--border))",
        cursor: "pointer",
      }}
    >
      <div
        ref={thumbRef}
        onMouseDown={onThumbMouseDown}
        style={{
          position: "absolute",
          top: 2,
          left: thumbLeft,
          width: thumbWidth,
          height: 10,
          borderRadius: 5,
          background: "hsl(var(--muted-foreground) / 0.5)",
          cursor: "grab",
          transition: dragging.current ? "none" : "background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = "hsl(var(--muted-foreground) / 0.7)";
        }}
        onMouseLeave={(e) => {
          if (!dragging.current) {
            (e.target as HTMLElement).style.background = "hsl(var(--muted-foreground) / 0.5)";
          }
        }}
      />
    </div>,
    document.body,
  );
}
