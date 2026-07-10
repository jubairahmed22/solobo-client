import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string | null;
  alt: string;
  size?: 24 | 32 | 40 | 48 | 64;
  fallback?: string;
}

export function Avatar({ src, alt, size = 40, fallback, className, ...props }: AvatarProps) {
  const initials =
    fallback ??
    alt
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("");

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-ink",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      {...props}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span className="font-medium" aria-hidden>
          {initials || "?"}
        </span>
      )}
    </span>
  );
}
