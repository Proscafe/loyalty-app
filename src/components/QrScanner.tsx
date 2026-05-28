"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

type QrScannerProps = {
  onResult: (text: string) => void | Promise<void>;
  onClose: () => void;
};

// QR_SCANNER_OPEN_CLIENT_FIX_V1
export function QrScanner({ onResult, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Point the camera at the client's QR code.");

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    async function startScanner() {
      try {
        if (!videoRef.current) return;

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, _error, control) => {
            if (cancelled || handledRef.current || !result) return;

            const scannedText = result.getText().trim();
            if (!scannedText) return;

            handledRef.current = true;
            setStatus("Opening client profile…");
            control.stop();
            controlsRef.current = null;

            void Promise.resolve(onResult(scannedText)).catch(() => {
              handledRef.current = false;
              setStatus("Could not open client. Try again.");
            });
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
      } catch (scannerError) {
        const message = scannerError instanceof Error ? scannerError.message : "Camera unavailable. Please allow camera access.";
        setError(message);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="font-display text-sm font-black uppercase tracking-[0.18em]">Scan client QR</div>
        <button type="button" onClick={onClose} className="text-sm font-bold text-white">
          Cancel
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 border-2 border-white/80" />
        <div className="pointer-events-none absolute bottom-8 left-6 right-6 rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-[#071a20]">
          {error ?? status}
        </div>
      </div>
    </div>
  );
}
