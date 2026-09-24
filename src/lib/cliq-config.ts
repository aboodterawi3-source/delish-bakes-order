import { useState, useEffect } from "react";

export interface CliqAccountConfig {
  id: string;
  label: string;
  icon: string;
  isStaffCustom?: boolean;
}

export const DEFAULT_CLIQ_ACCOUNTS: CliqAccountConfig[] = [
  { id: "mahmoud", label: "كليك محمود", icon: "💼" },
  { id: "shop", label: "كليك محل", icon: "🏬" },
  { id: "staff", label: "كليك موظفة معينة", icon: "👩‍💼", isStaffCustom: true },
];

const CLIQ_STORAGE_KEY = "delish_cliq_accounts_v1";
const CLIQ_CHANGE_EVENT = "delish_cliq_accounts_changed";

export function getStoredCliqAccounts(): CliqAccountConfig[] {
  if (typeof window === "undefined") return DEFAULT_CLIQ_ACCOUNTS;
  try {
    const raw = localStorage.getItem(CLIQ_STORAGE_KEY);
    if (!raw) return DEFAULT_CLIQ_ACCOUNTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return DEFAULT_CLIQ_ACCOUNTS.map((def) => {
        const found = parsed.find((p: any) => p && p.id === def.id);
        return found
          ? {
              ...def,
              label: typeof found.label === "string" && found.label.trim() ? found.label.trim() : def.label,
              icon: typeof found.icon === "string" && found.icon.trim() ? found.icon.trim() : def.icon,
            }
          : def;
      });
    }
  } catch (e) {
    console.error("Failed to parse cliq accounts config:", e);
  }
  return DEFAULT_CLIQ_ACCOUNTS;
}

export function saveStoredCliqAccounts(accounts: CliqAccountConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLIQ_STORAGE_KEY, JSON.stringify(accounts));
    window.dispatchEvent(new CustomEvent(CLIQ_CHANGE_EVENT, { detail: accounts }));
  } catch (e) {
    console.error("Failed to save cliq accounts config:", e);
  }
}

export function resetStoredCliqAccounts(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CLIQ_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CLIQ_CHANGE_EVENT, { detail: DEFAULT_CLIQ_ACCOUNTS }));
  } catch (e) {
    console.error("Failed to reset cliq accounts config:", e);
  }
}

export function useCliqAccounts() {
  const [accounts, setAccounts] = useState<CliqAccountConfig[]>(getStoredCliqAccounts);

  useEffect(() => {
    const handleSync = () => {
      setAccounts(getStoredCliqAccounts());
    };

    window.addEventListener(CLIQ_CHANGE_EVENT, handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener(CLIQ_CHANGE_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const updateAccountLabel = (id: string, newLabel: string) => {
    const updated = accounts.map((acc) =>
      acc.id === id ? { ...acc, label: newLabel } : acc
    );
    setAccounts(updated);
    saveStoredCliqAccounts(updated);
  };

  const saveAll = (newAccounts: CliqAccountConfig[]) => {
    setAccounts(newAccounts);
    saveStoredCliqAccounts(newAccounts);
  };

  const resetAll = () => {
    setAccounts(DEFAULT_CLIQ_ACCOUNTS);
    resetStoredCliqAccounts();
  };

  return {
    accounts,
    updateAccountLabel,
    saveAll,
    resetAll,
  };
}
