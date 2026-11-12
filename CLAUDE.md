# CLAUDE.md — Claude Coding Agent Instructions for LocaTrust

> **CRITICAL INSTRUCTION**: Read this file at the start of EVERY session and before EVERY task. If a request conflicts with this rule, STOP and tell the user instead of complying.

---

## NON-NEGOTIABLE RULE: SERVER IS THE SOURCE OF TRUTH

RULE "SERVER IS THE SOURCE OF TRUTH"
All business data for ALL users (owners, agencies, tenants, admins) must
live on the server (Supabase Postgres + Storage), scoped to the user's
account, and must be identical on every device. A user who logs into the
same account on any phone or computer must always see the same data, and
every action made on one device must appear on the others.
This rule applies to every feature written now and in the future. It can
never be broken, relaxed, or forgotten.

WHAT THE RULE FORBIDS
- Storing business data in localStorage, sessionStorage, IndexedDB, cookies,
  window globals, module-level arrays or objects, or persisted client
  stores (zustand persist, redux-persist, *Store.ts files) as a source of
  truth. Business data = contracts, payments, deposits, receipts,
  signatures, properties, tenants, applications, messages, notifications,
  documents, verification records, subscription status, user role.
- Mock or fake data (MOCK_*, INITIAL_* arrays, hard-coded demo records) in
  production code paths.
- Generating IDs, document numbers, or timestamps on the client. The
  database generates them (UUIDs, sequences, now()).
- Reading the user's role, permissions or subscription from a local cache
  to make decisions. Permissions are enforced by RLS on the server.
- Ephemeral-only events (WebSocket broadcasts) as the only record of
  something important. Every important event is written to the database.
- Showing a financial or legal action as successful before the server
  confirms it.

WHAT IS ALLOWED (the only exceptions)
1. Non-business UI preferences in localStorage: theme, language, sidebar
   state, last opened tab.
2. The per-user DISPLAY cache (IndexedDB, whitelist of summary data, max
   24 h, keyed by user id, wiped on logout/account switch, never used for
   writes, calculations, or permissions, always overwritten by server
   data).
3. Short-lived form drafts, preferably saved to the server; if local,
   they are deleted on submit, logout, and after 24 h.

