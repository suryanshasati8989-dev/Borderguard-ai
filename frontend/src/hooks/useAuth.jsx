import { createContext, useContext, useMemo, useState } from "react";
import api from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("bg_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("bg_user");
    return raw ? JSON.parse(raw) : null;
  });

  const value = useMemo(() => {
    const login = async (username, password) => {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("bg_token", data.token);
      localStorage.setItem("bg_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    };
    const logout = async () => {
      try {
        await api.post("/auth/logout");
      } catch {
        /* session may already be invalid */
      }
      localStorage.removeItem("bg_token");
      localStorage.removeItem("bg_user");
      setToken(null);
      setUser(null);
    };
    return {
      token,
      user,
      isAdmin: user?.role === "Administrator",
      login,
      logout,
    };
  }, [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
