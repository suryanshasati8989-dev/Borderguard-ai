import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api.js";

export default function MobilePublisher() {
  const [params] = useSearchParams();
  const cameraId = params.get("cam");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Initializing...");

  useEffect(() => {
    if (!cameraId) {
      setStatus("No camera ID provided.");
      return;
    }

    let stream = null;
    let interval = null;

    const startStreaming = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 640, height: 360 },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setStatus("Streaming to BorderGuard AI...");

        interval = setInterval(() => {
          if (!videoRef.current || !canvasRef.current) return;
          const ctx = canvasRef.current.getContext("2d");
          ctx.drawImage(videoRef.current, 0, 0, 640, 360);
          canvasRef.current.toBlob(blob => {
            if (blob) {
              api.post(`/stream/mobile_frame/${cameraId}`, blob, {
                headers: { "Content-Type": "image/jpeg" }
              }).catch(() => {});
            }
          }, "image/jpeg", 0.7);
        }, 100); // 10 FPS
      } catch (e) {
        setStatus("Error accessing camera: " + e.message);
      }
    };

    startStreaming();

    return () => {
      if (interval) clearInterval(interval);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [cameraId]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-xl font-mono text-phosphor-400 mb-4">MOBILE PUBLISHER</h1>
      <p className="mb-4 text-stone-400">{status}</p>
      
      <div className="relative w-full max-w-lg aspect-video bg-night-900 border-2 border-night-700 rounded-lg overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover" 
        />
      </div>
      
      <canvas ref={canvasRef} width="640" height="360" className="hidden" />
      
      <div className="mt-8 text-xs text-stone-500 font-mono">
        Keep this screen open to maintain the stream.
      </div>
    </div>
  );
}
