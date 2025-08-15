import { useRef, useState, useEffect } from "react";

export default function AccordionSection({
  title,
  subtitle,
  right,
  defaultOpen = false,
  children,
  id: idProp, // optional: if you want to pass a stable id
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef(null);
  const innerRef = useRef(null);
  const wrapRef = useRef(null);
  const id = idProp || `acc-${Math.random().toString(36).slice(2, 9)}`;

  // Set initial inline styles to avoid first‑paint jump
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = defaultOpen ? "auto" : "0px";
    el.style.overflow = defaultOpen ? "visible" : "hidden";
  }, [defaultOpen]);

  // Smooth height + inner fade/slide with WAAPI
  useEffect(() => {
    const el = bodyRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;

    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;

    const rect = el.getBoundingClientRect();
    const fromH = rect.height ?? 0;

    // Temporarily allow natural height to measure
    el.style.height = "auto";
    const natural = el.scrollHeight;
    const toH = open ? natural : 0;

    // Reset to measured starting height before animating
    el.style.height = `${fromH}px`;
    el.style.overflow = "hidden";

    // Cancel any in‑flight animations
    el.getAnimations?.().forEach((a) => a.cancel());
    inner.getAnimations?.().forEach((a) => a.cancel());

    if (prefersReduced) {
      el.style.height = open ? "auto" : "0px";
      el.style.overflow = open ? "visible" : "hidden";
      inner.style.opacity = open ? "1" : "0";
      inner.style.transform = open ? "none" : "translateY(-4px)";
      return;
    }

    const heightAnim = el.animate(
      [{ height: `${fromH}px` }, { height: `${toH}px` }],
      { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );

    const innerAnim = inner.animate(
      open
        ? [
            { opacity: 0, transform: "translateY(-6px)" },
            { opacity: 1, transform: "translateY(0px)" },
          ]
        : [
            { opacity: 1, transform: "translateY(0px)" },
            { opacity: 0, transform: "translateY(-6px)" },
          ],
      { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );

    heightAnim.onfinish = () => {
      el.style.height = open ? "auto" : "0px";
      el.style.overflow = open ? "visible" : "hidden";
    };

    return () => {
      heightAnim.cancel();
      innerAnim.cancel();
    };
  }, [open]);

  // If content inside grows/shrinks while open, smoothly adjust height
  useEffect(() => {
    if (!open || !bodyRef.current) return;
    const el = bodyRef.current;

    const ro = new ResizeObserver(() => {
      // Only adjust when we're in "auto" so it reflows smoothly
      if (el.style.height === "auto") return;
    });
    ro.observe(el);

    // Also animate to new height if inner content changes while open
    const inner = innerRef.current;
    const innerRO = new ResizeObserver(() => {
      if (!open || !el) return;
      const fromH = el.getBoundingClientRect().height;
      el.style.height = `${fromH}px`;
      const toH = inner.scrollHeight;
      el.getAnimations?.().forEach((a) => a.cancel());
      el.animate([{ height: `${fromH}px` }, { height: `${toH}px` }], {
        duration: 200,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      }).onfinish = () => (el.style.height = "auto");
    });
    if (inner) innerRO.observe(inner);

    return () => {
      ro.disconnect();
      innerRO.disconnect();
    };
  }, [open]);

  // Keep header in view on open
  useEffect(() => {
    if (open && wrapRef.current) {
      wrapRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [open]);

  return (
    <div ref={wrapRef} className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((o) => !o)}
        className={[
          "w-full h-11 md:h-12 rounded",
          "bg-primary text-primary-content",
          "px-4 md:px-5",
          "flex items-center justify-center relative",
          "shadow-md transition-all duration-150 hover:shadow-lg active:scale-[0.99]",
        ].join(" ")}
      >
        <div className="text-center leading-tight">
          <div className="text-[15px] md:text-base font-semibold truncate">
            {title}
          </div>
          {subtitle ? (
            <div className="text-[11px] md:text-[12px] opacity-85 truncate -mt-0.5">
              {subtitle}
            </div>
          ) : null}
        </div>

        {right ? (
          <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2">
            {right}
          </span>
        ) : null}

        <svg
          className={`absolute right-3 md:right-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.17l3.71-2.94a.75.75 0 111.06.02.75.75 0 01-.02 1.06l-4.24 3.36a.75.75 0 01-.94 0L5.25 8.29a.75.75 0 01-.02-1.08z" />
        </svg>
      </button>

      <div
        id={`${id}-panel`}
        ref={bodyRef}
        style={{ height: defaultOpen ? "auto" : "0px" }}
      >
        <div
          ref={innerRef}
          className="pt-3 px-0 will-change-transform will-change-opacity"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
