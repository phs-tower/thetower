-- ═══════════════════════════════════════════════════════════════════════════
-- Tower Console — storage policies for Vanguard spread PDFs
-- The `spreads` bucket is PRIVATE (existing rows carry long-lived signed
-- URLs). Editors upload PDFs from the console and mint 10-year signed URLs
-- client-side; minting a signed URL requires SELECT on the object row.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "editors manage spread pdfs" on storage.objects;
create policy "editors manage spread pdfs" on storage.objects
  for all to authenticated
  using (bucket_id = 'spreads' and public.is_editor())
  with check (bucket_id = 'spreads' and public.is_editor());
