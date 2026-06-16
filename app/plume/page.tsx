"use client";

import React from "react";
import dynamic from "next/dynamic";

const PlumeMapClient = dynamic(() => import("./PlumeMapClient"), {
  ssr: false,
});

export default function PlumeMapPage() {
  return <PlumeMapClient />;
}
