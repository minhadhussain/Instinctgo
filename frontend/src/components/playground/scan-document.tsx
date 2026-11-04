"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { Modal } from "./ui";

export function ScanDocument({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable in this browser. Use a photo from your device.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        if (!disposed) setReady(true);
      } catch (cause) {
        if (!disposed) setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access or choose a photo below." : cause instanceof Error ? cause.message : "No camera is available. Choose a photo below.");
      }
    }
    void start();
    return () => { disposed = true; stream?.getTracks().forEach((track) => track.stop()); };
  }, [attempt]);

  function capture() {
    if (!video.current?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext("2d")?.drawImage(video.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { setError("The image could not be captured. Please try again."); return; }
      onCapture(new File([blob], `Scanned-document-${Date.now()}.jpg`, { type: "image/jpeg" }));
      onClose();
    }, "image/jpeg", 0.92);
  }

  return <Modal title="Scan document" onClose={onClose} wide>
    <p className="pg-help">Position the document inside the camera frame, then capture a clear image.</p>
    <div className="pg-camera"><video ref={video} playsInline muted aria-label="Document camera preview" />{!ready && !error && <span role="status">Connecting to camera…</span>}</div>
    {error && <p className="pg-form-error" role="alert">{error}</p>}
    <div className="pg-scan-actions"><button className="pg-button pg-primary" disabled={!ready} onClick={capture}><Camera size={16} />Capture document</button>{error && <button className="pg-button" onClick={() => { setError(""); setReady(false); setAttempt(attempt + 1); }}><RotateCcw size={14} />Retry camera</button>}<label className="pg-button pg-file-label">Use a photo<input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) { onCapture(file); onClose(); } }} /></label></div>
  </Modal>;
}
