"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Camera, RotateCcw, Zap, Check, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/use-haptic";

interface ArtworkScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
}

export function ArtworkScanner({ isOpen, onClose, onCapture }: ArtworkScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [frameDetected, setFrameDetected] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [prevFrameDetected, setPrevFrameDetected] = useState(false);
  const { triggerLight, triggerMedium, triggerSuccess } = useHaptic();

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // `video.play()` rejects on some Chromium builds when the
        // element is detached or the stream is interrupted (e.g. user
        // backgrounds the tab during getUserMedia). Swallow the
        // rejection so it doesn't surface as an uncaught promise — we
        // still mark the stream as ready since `srcObject` is wired up.
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Video element play() rejected:", playErr);
        }
        setStream(mediaStream);
        setIsReady(true);
      } else {
        // Component unmounted before the stream resolved — release the
        // tracks immediately to avoid a dangling camera indicator.
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsReady(false);
  }, [stream]);

  // Handle open/close
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, startCamera, stopCamera, stream]);

  // Simulated frame detection (in production, this would use ML)
  useEffect(() => {
    if (!isReady) return;
    
    const interval = setInterval(() => {
      // Simulate frame detection with random chance
      const detected = Math.random() > 0.3;
      setFrameDetected(detected);
      
      // Haptic feedback when frame is newly detected
      if (detected && !prevFrameDetected) {
        triggerLight();
      }
      setPrevFrameDetected(detected);
    }, 500);

    return () => clearInterval(interval);
  }, [isReady, prevFrameDetected, triggerLight]);

  // Capture image
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    triggerMedium(); // Haptic on capture

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageData);
  };

  // Confirm capture
  const handleConfirm = () => {
    if (capturedImage) {
      triggerSuccess(); // Haptic on confirm
      onCapture(capturedImage);
      onClose();
    }
  };

  // Retake
  const handleRetake = () => {
    setCapturedImage(null);
  };

  // Switch camera
  const switchCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera preview or captured image */}
      <div className="relative w-full h-full">
        {capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured artwork"
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {/* Frame guide overlay */}
        {!capturedImage && isReady && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner brackets */}
            <div className="absolute inset-8 sm:inset-16">
              {/* Top-left corner */}
              <div className={cn(
                "absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 rounded-tl-lg transition-colors",
                frameDetected ? "border-accent" : "border-white/60"
              )} />
              {/* Top-right corner */}
              <div className={cn(
                "absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 rounded-tr-lg transition-colors",
                frameDetected ? "border-accent" : "border-white/60"
              )} />
              {/* Bottom-left corner */}
              <div className={cn(
                "absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 rounded-bl-lg transition-colors",
                frameDetected ? "border-accent" : "border-white/60"
              )} />
              {/* Bottom-right corner */}
              <div className={cn(
                "absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 rounded-br-lg transition-colors",
                frameDetected ? "border-accent" : "border-white/60"
              )} />
            </div>

            {/* Detection status */}
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
              <div className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                frameDetected 
                  ? "bg-accent text-accent-foreground" 
                  : "bg-black/50 text-white"
              )}>
                {frameDetected ? (
                  <span className="flex items-center gap-2">
                    <Check size={16} /> artwork detected
                  </span>
                ) : (
                  "align artwork within frame"
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 safe-area-inset-top p-4 pt-12 flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center"
          >
            <X size={20} className="text-white" />
          </button>
          
          {!capturedImage && (
            <div className="flex gap-2">
              <button
                onClick={() => setFlashOn(!flashOn)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  flashOn ? "bg-accent" : "bg-black/50"
                )}
              >
                <Zap size={18} className={flashOn ? "text-accent-foreground" : "text-white"} />
              </button>
              <button
                onClick={switchCamera}
                className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center"
              >
                <RotateCcw size={18} className="text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 safe-area-inset-bottom p-6 pb-10">
          {capturedImage ? (
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={handleRetake}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <RotateCcw size={22} className="text-white" />
                </div>
                <span className="text-white text-xs">retake</span>
              </button>
              <button
                onClick={handleConfirm}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center">
                  <Check size={32} className="text-accent-foreground" />
                </div>
                <span className="text-white text-xs">use photo</span>
              </button>
              <button className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <Maximize2 size={22} className="text-white" />
                </div>
                <span className="text-white text-xs">crop</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <button
                onClick={handleCapture}
                disabled={!isReady}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50"
              >
                <div className={cn(
                  "w-16 h-16 rounded-full transition-colors",
                  frameDetected ? "bg-accent" : "bg-white"
                )} />
              </button>
            </div>
          )}
        </div>

        {/* Loading state */}
        {!isReady && !capturedImage && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center">
              <Camera size={48} className="text-white/60 mx-auto mb-4" />
              <p className="text-white/60">Starting camera...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
