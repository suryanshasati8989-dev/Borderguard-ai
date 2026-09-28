import { X } from "lucide-react";
import QRCode from "react-qr-code";

export default function PhoneStreamModal({ camera, onClose }) {
  if (!camera) return null;

  // The publisher URL will be the frontend domain /mobile-publisher?cam=ID
  const publisherUrl = `${window.location.origin}/mobile-publisher?cam=${camera.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel max-w-lg w-full">
        <div className="flex justify-between items-center p-4 border-b border-night-700">
          <h2 className="font-mono text-phosphor-400">PHONE STREAM CONNECTOR</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <p className="text-sm text-stone-300">
              Scan this QR code with your mobile device to broadcast its camera directly into BorderGuard AI.
            </p>
          </div>
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-lg shadow-lg">
              <QRCode value={publisherUrl} size={180} />
            </div>
          </div>
          <div className="text-xs font-mono text-center text-stone-400 bg-night-800 p-3 rounded break-all">
            URL: <a href={publisherUrl} target="_blank" className="text-ice hover:underline">{publisherUrl}</a>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-night-700">
            <button onClick={onClose} className="px-4 py-2 border border-night-600 hover:border-stone-400 text-sm tracking-widest">CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  );
}
