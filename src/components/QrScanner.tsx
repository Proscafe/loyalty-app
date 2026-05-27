"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

export function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,                // pick default camera (usually rear on mobile)
          videoRef.current!,
          (res, _err, ctl) => {
            if (cancelled) return;
            if (res) {
              ctl.stop();
              onResult(res.getText());
            }
          },
        );
        if (cancelled) controls.stop();
        controlsRef.current = controls;
      } catch (e: any) {
        setError(e?.message ?? "Camera unavailable. Please allow camera access.");
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="font-display font-semibold">Scan client QR</div>
        <button onClick={onClose} className="text-sm font-semibold">Cancel</button>
      </div>
      <div className="flex-1 relative flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-10 border-2 border-white/70 rounded-3xl" />
      </div>
      {error && (
        <div className="p-4 text-center text-red-200 text-sm">{error}</div>
      )}
      <div className="p-4 text-center text-white/70 text-xs">
        Point the camera at the client&apos;s QR code.
      </div>
    </div>
  );
}
