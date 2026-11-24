import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSession, signOut } from "@/lib/auth";

const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

export default function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((session) => {
        if (cancelled) return;
        setUser(session);
        setStatus(session ? "in" : "out");
      })
      .catch(() => {
        if (!cancelled) setStatus("out");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ status, user, logout: signOut }), [status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
