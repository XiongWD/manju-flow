"use client";
import { useEffect } from "react";
import { tabSync } from "@/lib/broadcast";

export function useTabSync(type: string, handler: (data: any) => void) {
  useEffect(() => {
    return tabSync.on(type, handler);
  }, [type, handler]);
}
