"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (apiClient.isAuthenticated()) {
      router.replace("/workspace");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
