import { useCallback, useEffect, useState } from "react";

/** Browser-only video input and Bluetooth discovery helper.
 * Bluetooth discovery identifies a nearby device but does not transport video;
 * phone feeds must still be shared as an RTSP or MJPEG URL on the local network.
 */
export function useWebcam() {
  const [stream, setStream] = useState(null);
  const [webcamError, setWebcamError] = useState("");
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const [bluetoothError, setBluetoothError] = useState("");
  const [scanningBluetooth, setScanningBluetooth] = useState(false);

  const stopWebcam = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }, [stream]);

  const startWebcam = useCallback(async () => {
    setWebcamError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setWebcamError("This browser does not allow camera access. Use a current Chrome, Edge, or Firefox build over a secure origin.");
      return null;
    }
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      stopWebcam();
      setStream(nextStream);
      return nextStream;
    } catch (error) {
      setWebcamError(error?.name === "NotAllowedError" ? "Camera permission was denied." : "Could not start the integrated camera.");
      return null;
    }
  }, [stopWebcam]);

  const scanBluetooth = useCallback(async () => {
    setBluetoothError("");
    if (!navigator.bluetooth?.requestDevice) {
      setBluetoothError("Web Bluetooth is unavailable here. Use Chrome or Edge on a supported desktop platform, then share the phone feed through RTSP/MJPEG.");
      return null;
    }
    setScanningBluetooth(true);
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      setBluetoothDevice({ id: device.id, name: device.name || "Unnamed Bluetooth device" });
      return device;
    } catch (error) {
      if (error?.name !== "NotFoundError") setBluetoothError("Bluetooth scan did not complete. Keep the device nearby and use a supported browser.");
      return null;
    } finally {
      setScanningBluetooth(false);
    }
  }, []);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  return {
    stream,
    webcamError,
    startWebcam,
    stopWebcam,
    bluetoothDevice,
    bluetoothError,
    scanningBluetooth,
    scanBluetooth,
    bluetoothSupported: Boolean(navigator.bluetooth?.requestDevice),
  };
}
