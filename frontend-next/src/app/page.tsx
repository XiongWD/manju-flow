"use client";

import Link from "next/link";
import { GlassSurface } from "@/components/ui/primitives";
import { GlassButton } from "@/components/ui/primitives";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-zinc-950 p-8">
      <GlassSurface variant="elevated" className="max-w-md w-full">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
            ArcLine Studio
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            ArcLine Studio — AI 内容生产工作台
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "#7C3AED" }}
            />
            <span className="text-xs text-zinc-500">Frontend Next 已就绪</span>
          </div>
        </div>
      </GlassSurface>

      <div className="flex gap-3">
        <Link href="/workspace">
          <GlassButton variant="primary" size="md">
            开始创作
          </GlassButton>
        </Link>
        <Link href="/workspace/projects">
          <GlassButton variant="secondary" size="md">
            浏览项目
          </GlassButton>
        </Link>
      </div>
    </div>
  );
}