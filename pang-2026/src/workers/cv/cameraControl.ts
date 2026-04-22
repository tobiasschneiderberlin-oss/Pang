/**
 * PANG — camera control adapter.
 *
 * One surface for "open the back camera with torch and tap-to-focus."
 * Primitive §13. Two implementations underneath:
 *
 *   - Chromium (Android + macOS Chrome):
 *       `new ImageCapture(track)` with `setOptions({ torch, focusMode })`
 *       and `track.applyConstraints({ advanced: [{ focusMode,
 *       pointsOfInterest }] })` for tap-to-focus.
 *
 *   - Safari (iOS 26 + macOS 15): no `ImageCapture` constructor. The
 *       shipped path is `MediaStreamTrack.applyConstraints({ advanced:
 *       [{ torch, focusMode }] })` directly. Tap-to-focus via the same
 *       constraint route with `pointsOfInterest`.
 *
 * Consumers never see the difference. `openBackCamera()` returns a
 * `CameraHandle` whose methods are no-ops when a capability is
 * missing; the UI degrades without branching.
 */

export interface FocusPoint {
  /** Normalised [0..1] coordinates from the top-left of the viewport. */
  x: number;
  y: number;
}

export interface CameraHandle {
  readonly stream: MediaStream;
  readonly track: MediaStreamVideoTrack;
  /** Capability flags discovered at open-time. */
  readonly supports: {
    torch: boolean;
    focusMode: boolean;
    tapToFocus: boolean;
    grabFrame: boolean;
  };
  /** Toggle the torch. No-op if unsupported. */
  setTorch(on: boolean): Promise<void>;
  /** Request a continuous-autofocus pass at the given point. */
  focusAt(point: FocusPoint): Promise<void>;
  /** Grab a single frame as an ImageBitmap (Chromium ImageCapture) or
   *  via a transient <video> draw (Safari fallback). */
  grabFrame(): Promise<ImageBitmap>;
  /** Stop the stream and release the device. */
  close(): void;
}

type MediaStreamVideoTrack = MediaStreamTrack & {
  getCapabilities?: () => MediaTrackCapabilities;
};

interface ExtendedTrackConstraints extends MediaTrackConstraintSet {
  torch?: boolean;
  focusMode?: string;
  pointsOfInterest?: Array<{ x: number; y: number }>;
}

interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  focusMode?: string[];
  pointsOfInterest?: boolean;
}

/**
 * Open the back camera at the requested resolution. Falls back to
 * the browser's default if the exact constraint isn't satisfiable.
 */
export async function openBackCamera(
  request: { width?: number; height?: number } = {},
): Promise<CameraHandle> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    throw new Error("camera: no mediaDevices");
  }

  // Build constraints incrementally to satisfy
  // `exactOptionalPropertyTypes`: width/height must be *absent* when
  // no hint is given, not `undefined`.
  const videoConstraints: MediaTrackConstraints = {
    facingMode: { ideal: "environment" },
    frameRate: { ideal: 30 },
  };
  if (request.width) videoConstraints.width = { ideal: request.width };
  if (request.height) videoConstraints.height = { ideal: request.height };
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: videoConstraints,
  });

  const track = stream.getVideoTracks()[0] as MediaStreamVideoTrack | undefined;
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("camera: no video track");
  }

  const caps = (track.getCapabilities?.() ?? {}) as ExtendedTrackCapabilities;
  const hasImageCapture =
    typeof (globalThis as { ImageCapture?: unknown }).ImageCapture !==
    "undefined";

  const supports = {
    torch: caps.torch === true,
    focusMode: Array.isArray(caps.focusMode) && caps.focusMode.length > 0,
    tapToFocus: caps.pointsOfInterest === true,
    grabFrame: hasImageCapture,
  } as const;

  const setTorch = async (on: boolean): Promise<void> => {
    if (!supports.torch) return;
    const constraints: { advanced: ExtendedTrackConstraints[] } = {
      advanced: [{ torch: on }],
    };
    try {
      await track.applyConstraints(constraints as MediaTrackConstraints);
    } catch {
      // Best-effort. Constraint failures bubble to observability via
      // the caller; here we swallow because "torch didn't toggle" is
      // a degraded experience, not a fatal one.
    }
  };

  const focusAt = async (point: FocusPoint): Promise<void> => {
    if (!supports.focusMode) return;
    const constraint: ExtendedTrackConstraints = {
      focusMode: supports.tapToFocus ? "single-shot" : "continuous",
    };
    if (supports.tapToFocus) {
      constraint.pointsOfInterest = [{ x: point.x, y: point.y }];
    }
    try {
      await track.applyConstraints({
        advanced: [constraint],
      } as MediaTrackConstraints);
    } catch {
      // As with torch — non-fatal.
    }
  };

  const grabFrame = async (): Promise<ImageBitmap> => {
    if (hasImageCapture) {
      // Double-cast through `unknown` because the DOM lib's shape of
      // `ImageCapture` differs between TS versions (24+ adds more
      // members we don't use). We only need `grabFrame()`.
      const ImageCaptureCtor = (
        globalThis as unknown as {
          ImageCapture: new (t: MediaStreamTrack) => { grabFrame(): Promise<ImageBitmap> };
        }
      ).ImageCapture;
      const cap = new ImageCaptureCtor(track);
      return cap.grabFrame();
    }
    // Safari fallback: draw the live track into an OffscreenCanvas
    // and produce an ImageBitmap from the result. This avoids pulling
    // the whole frame into a DOM `<video>` element.
    const settings = track.getSettings();
    const width = settings.width ?? 1280;
    const height = settings.height ?? 720;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const off = new OffscreenCanvas(width, height);
    const ctx = off.getContext("2d");
    if (!ctx) throw new Error("camera: no 2d context for fallback grab");
    ctx.drawImage(video, 0, 0, width, height);

    const bitmap = await createImageBitmap(off);
    video.pause();
    return bitmap;
  };

  const close = (): void => {
    stream.getTracks().forEach((t) => t.stop());
  };

  return { stream, track, supports, setTorch, focusAt, grabFrame, close };
}

/** Permission-probe. Call from a UX that wants to know whether a
 *  prompt will fire before showing the viewfinder. Prompting is a
 *  side-effect, not a read, so this only returns `granted | denied`
 *  when the Permissions API says so; otherwise `unknown`. */
export async function cameraPermissionState(): Promise<
  "granted" | "denied" | "prompt" | "unknown"
> {
  if (typeof navigator === "undefined" || !navigator.permissions) return "unknown";
  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    return status.state as "granted" | "denied" | "prompt";
  } catch {
    return "unknown";
  }
}
