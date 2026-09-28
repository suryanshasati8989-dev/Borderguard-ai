import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Maximize, Settings, SwitchCamera, Video, Square, Download, AlertTriangle, MonitorPlay, Activity } from "lucide-react";

export default function HardwareIntegration() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordedChunks = useRef([]);
  
  const [metrics, setMetrics] = useState({
    fps: 0,
    width: 0,
    height: 0,
    aspectRatio: "0:0",
    state: "DISCONNECTED",
    label: "None"
  });

  const fpsRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const reqRef = useRef(null);

  const getDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (e) {
      console.error("Device enumeration failed", e);
    }
  };

  const startStream = async (deviceId, mode = facingMode) => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    
    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: mode }
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      
      setError("");
      setMetrics(prev => ({ ...prev, state: "CONNECTED", label: newStream.getVideoTracks()[0].label }));
      getDevices(); // refresh after permission granted
    } catch (err) {
      console.error("GUM error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Camera access denied. Please grant permissions in your browser settings.");
      } else {
        setError(`Failed to access camera: ${err.message}`);
      }
      setMetrics(prev => ({ ...prev, state: "ERROR" }));
    }
  };

  useEffect(() => {
    // Initial permission request and device fetch
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => {
        s.getTracks().forEach(t => t.stop());
        getDevices();
        startStream(null, facingMode);
      })
      .catch(err => {
        setError("Camera permission is required to use this hardware diagnostic tool.");
        setMetrics(prev => ({ ...prev, state: "DENIED" }));
      });
      
    navigator.mediaDevices.addEventListener("devicechange", getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getDevices);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, []);

  const handleDeviceChange = (e) => {
    setSelectedDeviceId(e.target.value);
    startStream(e.target.value);
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    setSelectedDeviceId(""); // clear specific device ID to rely on facingMode
    startStream(null, nextMode);
  };

  // FPS tracking
  const trackFPS = useCallback(() => {
    if (!videoRef.current) return;
    
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    
    if (delta >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / delta);
      fpsRef.current = fps;
      frameCountRef.current = 0;
      lastTimeRef.current = now;
      
      const v = videoRef.current;
      if (v.videoWidth) {
        const w = v.videoWidth;
        const h = v.videoHeight;
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(w, h);
        const ratio = divisor > 0 ? `${w/divisor}:${h/divisor}` : "0:0";
        
        setMetrics(prev => ({
          ...prev,
          fps,
          width: w,
          height: h,
          aspectRatio: ratio
        }));
      }
    }
    
    frameCountRef.current++;
    reqRef.current = requestAnimationFrame(trackFPS);
  }, []);

  useEffect(() => {
    if (stream) {
      reqRef.current = requestAnimationFrame(trackFPS);
    }
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [stream, trackFPS]);

  // Actions
  const snapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `hardware_snapshot_${Date.now()}.png`;
    a.click();
  };

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    } else {
      if (!stream) return;
      const options = { mimeType: 'video/webm' };
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
      recordedChunks.current = [];
      
      recorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hardware_recording_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    }
  };

  const toggleFullScreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    } else if (videoRef.current.webkitRequestFullscreen) {
      videoRef.current.webkitRequestFullscreen();
    }
  };

  return (
    <div className="flex flex-col h-full bg-night-950 text-slate-200">
      <div className="flex items-center justify-between pb-4 border-b border-phosphor-500/10 mb-4">
        <div>
          <h1 className="text-xl tracking-wider font-semibold text-white flex items-center gap-2">
            <MonitorPlay size={20} className="text-phosphor-400" />
            HARDWARE DIAGNOSTICS
          </h1>
          <p className="text-xs text-stone-400 font-mono mt-1">Direct MediaDevices API access with raw telemetry</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 p-4 mb-4 flex gap-3 text-red-200 items-start">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-4 flex-1">
        
        {/* Main Viewport */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="relative flex-1 bg-black border border-night-700 min-h-[50vh] rounded flex items-center justify-center overflow-hidden">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-contain"
            />
            {metrics.state !== "CONNECTED" && !error && (
              <div className="text-stone-600 font-mono tracking-widest text-sm flex items-center gap-2">
                <Activity size={16} className="animate-pulse" /> 
                AWAITING SIGNAL
              </div>
            )}
            {isRecording && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-2 py-1 rounded text-xs font-mono text-red-400 border border-red-500/30">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                REC
              </div>
            )}
            {/* Corner HUD */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-phosphor-500/40 pointer-events-none" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-phosphor-500/40 pointer-events-none" />
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-night-900/60 border border-night-700 rounded">
            <button onClick={toggleFacingMode} className="tactical-button !bg-night-800 border border-night-600 !text-stone-300 hover:!bg-night-700">
              <SwitchCamera size={16} /> FLIP LENS
            </button>
            <div className="w-px h-6 bg-night-700 mx-1" />
            <button onClick={snapshot} disabled={metrics.state !== "CONNECTED"} className="tactical-button">
              <Camera size={16} /> SNAPSHOT
            </button>
            <button onClick={toggleRecording} disabled={metrics.state !== "CONNECTED"} className={`tactical-button ${isRecording ? '!bg-red-500 hover:!bg-red-400' : ''}`}>
              {isRecording ? <Square size={16} /> : <Video size={16} />}
              {isRecording ? "STOP RECORDING" : "START RECORDING"}
            </button>
            <div className="flex-1" />
            <button onClick={toggleFullScreen} className="icon-button" title="Full Screen">
              <Maximize size={16} />
            </button>
          </div>
        </div>

        {/* Telemetry Sidebar */}
        <div className="space-y-4">
          <div className="bg-night-900/60 border border-night-700 rounded p-4">
            <h3 className="text-xs font-semibold tracking-widest text-phosphor-400 mb-4 flex items-center gap-2">
              <Settings size={14} /> DEVICE SELECTOR
            </h3>
            <select 
              className="tactical-input !py-2"
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              disabled={devices.length === 0}
            >
              {devices.length === 0 && <option>No cameras found</option>}
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${d.deviceId.slice(0,5)}...`}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-night-900/60 border border-night-700 rounded p-4 font-mono text-xs">
            <h3 className="text-xs font-sans font-semibold tracking-widest text-phosphor-400 mb-4 flex items-center gap-2">
              <Activity size={14} /> RAW TELEMETRY
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-night-700/50 pb-2">
                <span className="text-stone-500">STATE</span>
                <span className={metrics.state === "CONNECTED" ? "text-phosphor-400" : "text-amber-400"}>{metrics.state}</span>
              </div>
              <div className="flex justify-between border-b border-night-700/50 pb-2">
                <span className="text-stone-500">FPS</span>
                <span className="text-white">{metrics.fps} hz</span>
              </div>
              <div className="flex justify-between border-b border-night-700/50 pb-2">
                <span className="text-stone-500">RESOLUTION</span>
                <span className="text-white">{metrics.width} x {metrics.height}</span>
              </div>
              <div className="flex justify-between border-b border-night-700/50 pb-2">
                <span className="text-stone-500">ASPECT RATIO</span>
                <span className="text-white">{metrics.aspectRatio}</span>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-stone-500">ACTIVE LENS</span>
                <span className="text-ice truncate" title={metrics.label}>{metrics.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden canvas for snapshotting */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
