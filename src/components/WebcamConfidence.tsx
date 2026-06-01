import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Camera, CameraOff } from "lucide-react";

const MODELS_URL = "https://justadudewhohacks.github.io/face-api.js/models";

export type ConfidenceHandle = {
  /** Returns current rolling confidence percentage (0-100). */
  getConfidence: () => number;
  /** Stops the camera. */
  stop: () => void;
};

export const WebcamConfidence = forwardRef<ConfidenceHandle, { active: boolean }>(
  function WebcamConfidence({ active }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const samplesRef = useRef<number[]>([]); // 1 for face detected, 0 otherwise
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [pct, setPct] = useState(0);

    useImperativeHandle(ref, () => ({
      getConfidence: () => {
        const arr = samplesRef.current;
        if (arr.length === 0) return 0;
        return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100);
      },
      stop: () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      },
    }));

    useEffect(() => {
      if (!active || typeof window === "undefined") return;
      let cancelled = false;
      let intervalId: ReturnType<typeof setInterval> | null = null;

      (async () => {
        try {
          const faceapi = await import("face-api.js");
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
          if (cancelled) return;
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: "user" },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
          }
          setReady(true);

          const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
          intervalId = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const det = await faceapi.detectSingleFace(videoRef.current, opts);
              const present = det ? 1 : 0;
              samplesRef.current.push(present);
              if (samplesRef.current.length > 180) samplesRef.current.shift(); // last 3 min
              const arr = samplesRef.current;
              setPct(Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100));
            } catch {
              /* swallow per-frame errors */
            }
          }, 1000);
        } catch (e) {
          setError((e as Error).message || "Could not access webcam");
        }
      })();

      return () => {
        cancelled = true;
        if (intervalId) clearInterval(intervalId);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
    }, [active]);

    if (!active) return null;

    return (
      <div className="glass rounded-2xl p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-semibold">
            {error ? <CameraOff className="h-3.5 w-3.5 text-destructive" /> : <Camera className="h-3.5 w-3.5 text-primary" />}
            Confidence cam
          </span>
          {ready && !error && (
            <span className={pct >= 70 ? "text-success" : pct >= 40 ? "text-warning" : "text-destructive"}>
              {pct}%
            </span>
          )}
        </div>
        {error ? (
          <p className="text-xs text-muted-foreground">{error}</p>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full rounded-md bg-black/40 aspect-[4/3] object-cover"
            />
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full transition-all"
                style={{
                  width: `${pct}%`,
                  background:
                    pct >= 70
                      ? "hsl(var(--success, 142 71% 45%))"
                      : pct >= 40
                        ? "hsl(var(--warning, 38 92% 50%))"
                        : "hsl(var(--destructive))",
                }}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Stay centered & facing the camera for higher scores.
            </p>
          </>
        )}
      </div>
    );
  },
);
