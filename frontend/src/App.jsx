import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import Login from "./pages/Login.jsx";
import TacticalDashboard from "./pages/TacticalDashboard.jsx";
import Cameras from "./pages/Cameras.jsx";
import CameraDetail from "./pages/CameraDetail.jsx";
import Events from "./pages/Events.jsx";
import Alerts from "./pages/Alerts.jsx";
import Analytics from "./pages/Analytics.jsx";
import Zones from "./pages/Zones.jsx";
import Settings from "./pages/Settings.jsx";
import MobilePublisher from "./pages/MobilePublisher.jsx";
import HardwareIntegration from "./pages/HardwareIntegration.jsx";
import LiveMonitor from "./pages/LiveMonitor.jsx";

function Guard({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/mobile-publisher" element={<MobilePublisher />} />
      <Route
        element={
          <Guard>
            <AppLayout />
          </Guard>
        }
      >
        <Route path="/dashboard" element={<TacticalDashboard />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/cameras/:id" element={<CameraDetail />} />
        <Route path="/events" element={<Events />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/zones" element={<Zones />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/hardware" element={<HardwareIntegration />} />
        <Route path="/live-monitor" element={<LiveMonitor />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
