import { lazy, Suspense, useState } from "react";
import { webglAvailable } from "@/lib/webgl";
import type { OrbMood } from "@/components/SaharaScene";

const SaharaScene = lazy(() => import("@/components/SaharaScene").then((module) => ({ default: module.SaharaScene })));

function CssOrb({ mood }: { mood: OrbMood }) {
  return (
    <div className={`orb-stage orb-mood-${mood}`}>
      <span className="orb-particle" />
      <span className="orb-particle" />
      <span className="orb-particle" />
      <div className="orb-ring-outer" />
      <div className="orb-ring" />
      <div className="orb-orbit">
        <span />
      </div>
      <div className="orb-core" />
      <div className="orb-frame" />
    </div>
  );
}

export function SaharaOrb({
  className = "h-56 w-56",
  mood = "idle",
}: {
  className?: string;
  mood?: OrbMood;
}) {
  const [webgl] = useState(webglAvailable);
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className={`orb-hover relative ${className}`} data-mood={mood} aria-hidden="true">
      <div className="orb-frame pointer-events-none absolute inset-0 rounded-full" />
      {webgl ? (
        <Suspense fallback={<CssOrb mood={mood} />}>
          <SaharaScene animate={!reduce} mood={mood} />
        </Suspense>
      ) : (
        <CssOrb mood={mood} />
      )}
    </div>
  );
}

export type { OrbMood };
