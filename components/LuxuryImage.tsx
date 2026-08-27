"use client";

import { useState } from "react";

type LuxuryImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
};

export default function LuxuryImage({
  src,
  alt = "",
  className = "",
}: LuxuryImageProps) {
  const [failed, setFailed] = useState(false);
  const imageSource = src?.trim();

  if (!imageSource || failed) {
    return null;
  }

  return (
    <img
      src={imageSource}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
