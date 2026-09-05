import { useEffect, useState } from "react";

export function isMobileViewport(
  viewportWidth: number | undefined,
  breakpoint = 768,
): boolean {
  return viewportWidth !== undefined && viewportWidth < breakpoint;
}

export function useIsMobile(MOBILE_BREAKPOINT = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    isMobileViewport(
      typeof window === "undefined" ? undefined : window.innerWidth,
      MOBILE_BREAKPOINT,
    ),
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const onChange = () => {
      setIsMobile(isMobileViewport(window.innerWidth, MOBILE_BREAKPOINT));
    };

    mql.addEventListener("change", onChange);
    onChange();

    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, [MOBILE_BREAKPOINT]);

  return isMobile;
}
