revoke execute on function public.procurar_partes(vector, int, boolean) from anon, authenticated, public;
revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
grant execute on function public.procurar_partes(vector, int, boolean) to service_role;