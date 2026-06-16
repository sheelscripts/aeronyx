"use client";

import React from "react";
import dynamic from "next/dynamic";

const MLInsightsClient = dynamic(() => import("./MLInsightsClient"), {
  ssr: false,
});

export default function MLInsightsPage() {
  return <MLInsightsClient />;
}
