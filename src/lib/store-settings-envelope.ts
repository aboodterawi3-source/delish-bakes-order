import { supabase } from "@/integrations/supabase/client";

export interface StoreSettingsConfigEnvelope {
  cliqAccounts?: Array<{ id: string; label: string; icon: string; isStaffCustom?: boolean }>;
  deliveryZones?: Array<{ fee: number; labelAr: string; labelEn: string; areas: string[] }>;
}

/** Parses the JSON configuration envelope stored in `store_settings.cliq_alias`. */
export function parseStoreSettingsEnvelope(raw: unknown): StoreSettingsConfigEnvelope {
  if (typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return { cliqAccounts: parsed };
    }
    if (parsed && typeof parsed === "object") {
      return parsed as StoreSettingsConfigEnvelope;
    }
  } catch {
    // Plain text alias (e.g. "DELISHBAKES") -> return empty envelope
  }
  return {};
}

let persistEnvelopeQueue: Promise<void> = Promise.resolve();

/**
 * Serialized read-modify-write helper for individual keys inside the shared
 * `store_settings.cliq_alias` JSON envelope.
 */
export function persistStoreSettingsEnvelopeField<K extends keyof StoreSettingsConfigEnvelope>(
  field: K,
  value: StoreSettingsConfigEnvelope[K],
): Promise<void> {
  const run = persistEnvelopeQueue
    .catch(() => undefined)
    .then(async () => {
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
    });

  persistEnvelopeQueue = run;
  return run;
}

/** Reads a single field from the singleton `store_settings.cliq_alias` envelope. */
export async function fetchStoreSettingsEnvelopeField<K extends keyof StoreSettingsConfigEnvelope>(
  field: K,
): Promise<StoreSettingsConfigEnvelope[K] | null> {
  const { data, error } = await supabase
    .from("store_settings")
    .select("cliq_alias")
    .eq("singleton", true)
    .maybeSingle();

  if (error) {
    console.warn(`[store_settings] error fetching ${String(field)}:`, error);
    return null;
  }
  const envelope = parseStoreSettingsEnvelope((data as { cliq_alias?: string } | null)?.cliq_alias);
  return envelope[field] ?? null;
}
