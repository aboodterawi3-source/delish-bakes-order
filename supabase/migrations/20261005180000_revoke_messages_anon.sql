-- Migration: Revoke INSERT on customer_messages from anon, public
-- Strict ACL Defense

REVOKE INSERT ON public.customer_messages FROM anon, public;
