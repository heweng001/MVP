import { NextRequest } from "next/server";
import {
  assertSeoWorkerAuth,
  guessGscPropertyUrl,
  seoWorkerSecret,
} from "@/lib/seo-worker-auth";

/** @deprecated 使用 seoWorkerSecret */
export function gscWorkerSecret() {
  return seoWorkerSecret();
}

export function assertGscWorkerAuth(req: NextRequest): string | null {
  return assertSeoWorkerAuth(req);
}

export { guessGscPropertyUrl };
