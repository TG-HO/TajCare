"use client";

import { useState, useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function ProgressLoaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleLinkClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (target && target.href && target.href.startsWith(window.location.origin)) {
        if (target.pathname !== window.location.pathname || target.search !== window.location.search) {
          setLoading(true);
        }
      }
    }

    document.addEventListener("click", handleLinkClick);
    return () => document.removeEventListener("click", handleLinkClick);
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <div className="h-1 bg-gradient-to-r from-purple-600 via-emerald-400 to-indigo-600 animate-pulse shadow-md transition-all duration-300 w-full" />
    </div>
  );
}

export default function NavigationProgressLoader() {
  return (
    <Suspense fallback={null}>
      <ProgressLoaderContent />
    </Suspense>
  );
}
