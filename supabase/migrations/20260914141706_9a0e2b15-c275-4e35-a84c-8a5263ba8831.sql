create policy "Admin gere ficheiros de documentos" on storage.objects for all to authenticated
using (bucket_id = 'documentos' and public.has_role(auth.uid(), 'admin'))
with check (bucket_id = 'documentos' and public.has_role(auth.uid(), 'admin'));