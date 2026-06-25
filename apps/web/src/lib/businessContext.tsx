import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { apiJson } from "./api";

export type Role = "owner" | "admin" | "pencatat" | "viewer";

export interface BusinessWithRole {
  id: string;
  name: string;
  currency: string;
  role: Role;
}

interface BusinessCtx {
  businesses: BusinessWithRole[];
  current: BusinessWithRole | null;
  loading: boolean;
  setCurrentId: (id: string) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<BusinessCtx | null>(null);
const STORAGE_KEY = "catat:currentBusinessId";

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businesses, setBusinesses] = useState<BusinessWithRole[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ businesses: BusinessWithRole[] }>("/api/businesses");
      setBusinesses(data.businesses);
      setCurrentIdState((prev) => {
        if (prev && data.businesses.some((b) => b.id === prev)) return prev;
        return data.businesses[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setCurrentId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setCurrentIdState(id);
  }, []);

  const current = businesses.find((b) => b.id === currentId) ?? null;

  return (
    <Ctx.Provider value={{ businesses, current, loading, setCurrentId, refresh }}>{children}</Ctx.Provider>
  );
}

export function useBusiness(): BusinessCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBusiness harus dipakai di dalam BusinessProvider");
  return ctx;
}
