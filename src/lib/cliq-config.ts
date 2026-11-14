import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
export const CLIQ_SETTINGS_QUERY_KEY = ["store_settings_cliq_accounts"] as const;

function mergeWithDefaults(parsed: unknown): CliqAccountConfig[] | null {
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  return DEFAULT_CLIQ_ACCOUNTS.map((def) => {
    const found = parsed.find((p: any) => p && p.id === def.id);
    return found
      ? {
          ...def,
          label:
            typeof found.label === "string" && found.label.trim()
              ? found.label.trim()
              : def.label,
          icon:
            typeof found.icon === "string" && found.icon.trim() ? found.icon.trim() : def.icon,
        }
      : def;
  });
}

export interface StoreSettingsConfigEnvelope {
  cliqAccounts?: CliqAccountConfig[];
  deliveryZones?: unknown[];
}

export function parseStoreSettingsEnvelope(raw: unknown): StoreSettingsConfigEnvelope {
  if (typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const merged = mergeWithDefaults(parsed);
      return merged ? { cliqAccounts: merged } : {};
    }
    if (parsed && typeof parsed === "object") {
      return parsed as StoreSettingsConfigEnvelope;
    }
  } catch {
    // Plain text alias (e.g. "DELISHBAKES") -> return empty envelope
  }
  return {};
}

export async function persistStoreSettingsEnvelopeField<K extends keyof StoreSettingsConfigEnvelope>(
  field: K,
  value: StoreSettingsConfigEnvelope[K],
): Promise<void> {
  const { data: currentRow } = await supabase
    .from("store_settings")
    .select("cliq_alias")
    .eq("singleton", true)
    .maybeSingle();

  const existing = parseStoreSettingsEnvelope(
    (currentRow as { cliq_alias?: string } | null)?.cliq_alias,
  );
  const nextEnvelope: StoreSettingsConfigEnvelope = {
    ...existing,
    [field]: value,
  };
  const payload = JSON.stringify(nextEnvelope);

  const { data: updatedRows, error: updateErr } = await supabase
    .from("store_settings")
    .update({ cliq_alias: payload } as never)
    .eq("singleton", true)
    .select("cliq_alias");

  let error = updateErr;
  if (!error && (!updatedRows || updatedRows.length === 0)) {
    const { error: insertErr } = await supabase
      .from("store_settings")
      .insert({ singleton: true, cliq_alias: payload } as never);
    error = insertErr;
  }

  if (error) throw error;
}

function parseCliqAliasJson(raw: unknown): CliqAccountConfig[] | null {
  const envelope = parseStoreSettingsEnvelope(raw);
  return mergeWithDefaults(envelope.cliqAccounts);
}

export function getStoredCliqAccounts(): CliqAccountConfig[] {
  if (typeof window === "undefined") return DEFAULT_CLIQ_ACCOUNTS;
  try {
    const raw = localStorage.getItem(CLIQ_STORAGE_KEY);
    if (!raw) return DEFAULT_CLIQ_ACCOUNTS;
    const merged = mergeWithDefaults(JSON.parse(raw));
    if (merged) return merged;
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
  const queryClient = useQueryClient();
  const [localAccounts, setLocalAccounts] = useState<CliqAccountConfig[]>(getStoredCliqAccounts);

  const { data: dbAccounts } = useQuery({
    queryKey: CLIQ_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("cliq_alias")
        .eq("singleton", true)
        .maybeSingle();

      if (error) {
        console.warn("[store_settings] error fetching cliq_alias:", error);
        return null;
      }
      return parseCliqAliasJson((data as { cliq_alias?: string } | null)?.cliq_alias);
    },
    staleTime: 5_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (dbAccounts) {
      setLocalAccounts(dbAccounts);
      saveStoredCliqAccounts(dbAccounts);
    }
  }, [dbAccounts]);

  useEffect(() => {
    const handleSync = () => {
      setLocalAccounts(getStoredCliqAccounts());
    };

    window.addEventListener(CLIQ_CHANGE_EVENT, handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener(CLIQ_CHANGE_EVENT, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const accounts = dbAccounts ?? localAccounts;

  const saveAll = async (newAccounts: CliqAccountConfig[]) => {
    const normalized = mergeWithDefaults(newAccounts) ?? DEFAULT_CLIQ_ACCOUNTS;
    setLocalAccounts(normalized);
    saveStoredCliqAccounts(normalized);
    queryClient.setQueryData(CLIQ_SETTINGS_QUERY_KEY, normalized);

    try {
      await persistStoreSettingsEnvelopeField("cliqAccounts", normalized);
    } catch (error) {
      console.error("[store_settings] failed to save cliq_alias:", error);
      await queryClient.invalidateQueries({ queryKey: CLIQ_SETTINGS_QUERY_KEY });
      throw error;
    }

    await queryClient.invalidateQueries({ queryKey: CLIQ_SETTINGS_QUERY_KEY });
  };

  const updateAccountLabel = async (id: string, newLabel: string) => {
    const updated = accounts.map((acc) => (acc.id === id ? { ...acc, label: newLabel } : acc));
    await saveAll(updated);
  };

  const resetAll = async () => {
    setLocalAccounts(DEFAULT_CLIQ_ACCOUNTS);
    resetStoredCliqAccounts();
    queryClient.setQueryData(CLIQ_SETTINGS_QUERY_KEY, DEFAULT_CLIQ_ACCOUNTS);

    try {
      await persistStoreSettingsEnvelopeField("cliqAccounts", DEFAULT_CLIQ_ACCOUNTS);
    } catch (error) {
      console.error("[store_settings] failed to reset cliq_alias:", error);
      await queryClient.invalidateQueries({ queryKey: CLIQ_SETTINGS_QUERY_KEY });
      throw error;
    }

    await queryClient.invalidateQueries({ queryKey: CLIQ_SETTINGS_QUERY_KEY });
  };

  return {
    accounts,
    updateAccountLabel,
    saveAll,
    resetAll,
  };
}
