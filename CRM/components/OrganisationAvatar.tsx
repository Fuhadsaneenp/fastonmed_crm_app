"use client";

import React from "react";

export const AVATAR_PALETTES = [
  { bg: "#f0fdfa", text: "#0f766e", border: "#ccfbf1" }, // Teal
  { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" }, // Sky
  { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" }, // Blue
  { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" }, // Purple
  { bg: "#fdf4ff", text: "#a21caf", border: "#f5d0fe" }, // Fuchsia
  { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" }, // Green
  { bg: "#fffbeb", text: "#b45309", border: "#fde68a" }, // Amber
  { bg: "#f8fafc", text: "#334155", border: "#cbd5e1" }, // Slate
];

export function getOrgInitials(name: string): string {
  if (!name) return "FM";
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "FM";

  // Filter out corporate/legal suffixes if there are other words to use
  const filteredWords = words.filter((w, i) => {
    if (i === 0) return true;
    const up = w.toUpperCase();
    return !["LLC", "FZCO", "FZE", "L.L.C", "TR", "TRADING", "COMPANY", "CO", "OF", "BR", "LTD"].includes(up);
  });

  const pickFrom = filteredWords.length >= 2 ? filteredWords : words;
  if (pickFrom.length >= 2) {
    return (pickFrom[0][0] + pickFrom[1][0]).toUpperCase();
  }
  return (pickFrom[0] || name).slice(0, 2).toUpperCase();
}

export function getOrgAvatarStyle(name: string, isIndividual = false) {
  if (isIndividual) {
    return { bg: "#fef3c7", text: "#92400e", border: "#fde68a" };
  }
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export default function OrganisationAvatar({
  name,
  logo,
  photo,
  size = 32,
  isIndividual = false,
  className,
  style,
}: {
  name: string;
  logo?: string;
  photo?: string;
  size?: number;
  isIndividual?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const imgSrc = photo || logo;
  const initials = getOrgInitials(name);
  const palette = getOrgAvatarStyle(name, isIndividual);

  const [imgFailed, setImgFailed] = React.useState(false);

  const fontSize = size <= 28 ? 10.5 : size <= 36 ? 12 : size <= 48 ? 14 : 18;

  if (imgSrc && !imgFailed) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          backgroundColor: palette.bg,
          border: `1px solid ${palette.border}`,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
          ...style,
        }}
      >
        <img
          src={imgSrc}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${palette.bg} 0%, #ffffff 100%)`,
        color: palette.text,
        border: `1.5px solid ${palette.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        flexShrink: 0,
        userSelect: "none",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
        ...style,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
