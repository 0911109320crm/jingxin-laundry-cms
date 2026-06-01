"use client";

import { useEffect, useState } from "react";

/**
 * 是否為手機/平板寬度（預設 <1024px）。
 * SSR 先當桌機(false)，掛載後依實際視窗校正——用於「真手機就別套桌機展示外框」這類情境。
 */
export function useIsMobile(maxWidth = 1023): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);
  return isMobile;
}
