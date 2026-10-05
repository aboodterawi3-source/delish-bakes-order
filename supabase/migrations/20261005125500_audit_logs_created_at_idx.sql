-- Index on audit_logs (created_at DESC) for lightning-fast queries in Admin audit panel
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc
  ON public.audit_logs (created_at DESC);
