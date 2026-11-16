import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";

interface FallbackImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  fallbackSrc: string;
  renderFallback?: () => ReactNode;
}

/**
 * Renders `src` with automatic swap to `fallbackSrc` on error, resetting cleanly
 * when either URL changes and rendering `renderFallback` if both fail.
 */
export function FallbackImage({
  src,
  fallbackSrc,
  renderFallback,
  alt,
  onError,
  ...imgProps
}: FallbackImageProps) {
  const initialSrc = src || fallbackSrc;
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
    setFailed(false);
  }, [src, fallbackSrc]);

  if ((failed || !currentSrc) && renderFallback) {
    return <>{renderFallback()}</>;
  }

  return (
    <img
      {...imgProps}
      src={currentSrc}
      alt={alt}
      onError={(e) => {
        onError?.(e);
        if (currentSrc !== fallbackSrc && fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
