"use client";

import dynamic from "next/dynamic";

export const ScenePreview = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-xl bg-brand-gray" />,
});
