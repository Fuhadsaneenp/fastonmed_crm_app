import React, { useState } from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "stacked";
  theme?: "dark" | "light"; // dark = on dark background (white Faston), light = on light background (dark teal Faston)
}

export function FastonmedIcon({
  size = 32,
  className = "",
}: {
  size?: number;
  color?: string;
  headColor?: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const width = Math.round((size * 114) / 92);

  if (imgError) {
    return (
      <svg
        width={width}
        height={size}
        viewBox="0 0 84 70"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ height: `${size}px`, width: "auto", display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
      >
        <circle cx="42" cy="18" r="8" fill="#42B69C" />
        <g>
          <rect x="7" y="27" width="28" height="9.5" rx="4.75" transform="rotate(-24 21 32)" fill="#42B69C" />
          <rect x="12" y="44" width="26" height="9.5" rx="4.75" transform="rotate(-24 25 49)" fill="#42B69C" />
          <rect x="18" y="60" width="22" height="9.5" rx="4.75" transform="rotate(-24 29 65)" fill="#42B69C" />
        </g>
        <g transform="translate(84, 0) scale(-1, 1)">
          <rect x="7" y="27" width="28" height="9.5" rx="4.75" transform="rotate(-24 21 32)" fill="#42B69C" />
          <rect x="12" y="44" width="26" height="9.5" rx="4.75" transform="rotate(-24 25 49)" fill="#42B69C" />
          <rect x="18" y="60" width="22" height="9.5" rx="4.75" transform="rotate(-24 29 65)" fill="#42B69C" />
        </g>
      </svg>
    );
  }

  return (
    <img
      src="/fastonmed-icon.png"
      alt="Fastonmed"
      width={width}
      height={size}
      onError={() => setImgError(true)}
      className={className}
      style={{
        height: `${size}px`,
        width: "auto",
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}

export default function FastonmedLogo({
  size = "md",
  variant = "full",
  theme = "dark",
  className = "",
}: LogoProps) {
  const [imgError, setImgError] = useState(false);

  // Height sizing
  const heights = {
    sm: 26,
    md: 32,
    lg: 40,
    xl: 52,
  };

  const h = heights[size];
  const w = Math.round((h * 240) / 70);

  if (variant === "icon") {
    return <FastonmedIcon size={h} className={className} />;
  }

  const fastonTextColor = theme === "dark" ? "#ffffff" : "#004D66";

  // If image fails or for immediate bulletproof display, inline SVG is guaranteed to render
  if (imgError) {
    return (
      <div
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          lineHeight: 0,
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        <svg
          width={w}
          height={h}
          viewBox="0 0 240 70"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ height: `${h}px`, width: "auto", display: "block" }}
        >
          <circle cx="42" cy="18" r="8" fill="#42B69C" />
          <g>
            <rect x="7" y="27" width="28" height="9.5" rx="4.75" transform="rotate(-24 21 32)" fill="#42B69C" />
            <rect x="12" y="44" width="26" height="9.5" rx="4.75" transform="rotate(-24 25 49)" fill="#42B69C" />
            <rect x="18" y="60" width="22" height="9.5" rx="4.75" transform="rotate(-24 29 65)" fill="#42B69C" />
          </g>
          <g transform="translate(84, 0) scale(-1, 1)">
            <rect x="7" y="27" width="28" height="9.5" rx="4.75" transform="rotate(-24 21 32)" fill="#42B69C" />
            <rect x="12" y="44" width="26" height="9.5" rx="4.75" transform="rotate(-24 25 49)" fill="#42B69C" />
            <rect x="18" y="60" width="22" height="9.5" rx="4.75" transform="rotate(-24 29 65)" fill="#42B69C" />
          </g>
          <text x="88" y="49" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="34" fill={fastonTextColor} letterSpacing="-1.5">Faston</text>
          <text x="182" y="49" fontFamily="Inter, system-ui, sans-serif" fontWeight="300" fontSize="34" fill="#42B69C" letterSpacing="-0.5">med</text>
        </svg>
      </div>
    );
  }

  const logoSrc = theme === "dark" ? "/fastonmed-logo-dark.png" : "/fastonmed-logo.png";

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 0,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <img
        src={logoSrc}
        alt="Fastonmed"
        width={w}
        height={h}
        onError={() => setImgError(true)}
        style={{
          height: `${h}px`,
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}
