create extension if not exists vector;

create type public.app_role as enum ('admin');

create table public.funcoes_utilizador (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.funcoes_utilizador to authenticated;
grant all on public.funcoes_utilizador to service_role;
alter table public.funcoes_utilizador enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.funcoes_utilizador where user_id = _user_id and role = _role)
$$;

create policy "Ver as proprias funcoes" on public.funcoes_utilizador
for select to authenticated using (user_id = auth.uid());

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  created_at timestamptz not null default now()
);
grant select on public.categorias to anon;
grant select, insert, update, delete on public.categorias to authenticated;
grant all on public.categorias to service_role;
alter table public.categorias enable row level security;
create policy "Categorias visiveis a todos" on public.categorias for select to anon, authenticated using (true);
create policy "Admin gere categorias" on public.categorias for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria_id uuid references public.categorias(id) on delete set null,
  acesso text not null default 'publico',
  origem text not null default 'texto',
  ficheiro_path text,
  conteudo text not null default '',
  estado text not null default 'pendente',
  erro text,
  total_partes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.documentos to anon;
grant select, insert, update, delete on public.documentos to authenticated;
grant all on public.documentos to service_role;
alter table public.documentos enable row level security;
create policy "Documentos publicos visiveis a todos" on public.documentos for select to anon, authenticated using (acesso = 'publico');
create policy "Admin gere documentos" on public.documentos for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.partes_documento (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos(id) on delete cascade,
  ordem integer not null,
  conteudo text not null,
  embedding vector(3072),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.partes_documento to authenticated;
grant all on public.partes_documento to service_role;
alter table public.partes_documento enable row level security;
create policy "Admin gere partes" on public.partes_documento for all to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create index partes_documento_embedding_idx on public.partes_documento
using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
create index partes_documento_doc_idx on public.partes_documento (documento_id);

create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  sessao text not null,
  perfil text not null default 'estudante',
  titulo text,
  created_at timestamptz not null default now()
);
grant select, insert on public.conversas to anon, authenticated;
grant all on public.conversas to service_role;
alter table public.conversas enable row level security;
create policy "Qualquer pessoa cria conversas" on public.conversas for insert to anon, authenticated with check (true);
create policy "Admin ve conversas" on public.conversas for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  papel text not null,
  conteudo text not null,
  fontes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.mensagens to anon, authenticated;
grant all on public.mensagens to service_role;
alter table public.mensagens enable row level security;
create policy "Qualquer pessoa cria mensagens" on public.mensagens for insert to anon, authenticated with check (true);
create policy "Admin ve mensagens" on public.mensagens for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.procurar_partes(
  query_embedding vector(3072),
  match_count int default 6,
  incluir_internos boolean default false
)
returns table (
  documento_id uuid,
  titulo text,
  categoria text,
  acesso text,
  conteudo text,
  similaridade float
)
language sql stable security definer set search_path = public as $$
  select p.documento_id, d.titulo, c.nome, d.acesso, p.conteudo,
         1 - (p.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similaridade
  from public.partes_documento p
  join public.documentos d on d.id = p.documento_id
  left join public.categorias c on c.id = d.categoria_id
  where p.embedding is not null
    and d.estado = 'pronto'
    and (incluir_internos or d.acesso = 'publico')
  order by p.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger documentos_updated_at before update on public.documentos
for each row execute function public.set_updated_at();

insert into public.categorias (nome, descricao) values
  ('Académico', 'Cursos, disciplinas, avaliações e planos curriculares'),
  ('Financeiro', 'Propinas, pagamentos e multas'),
  ('Biblioteca', 'Localização, horários e regras'),
  ('Regulamentos', 'Regulamento académico e normas'),
  ('Sistemas', 'Manuais dos sistemas institucionais'),
  ('Estudantes', 'Matrícula, inscrição, notas e declarações'),
  ('DAF', 'Procedimentos financeiros e administrativos'),
  ('Pedagógico', 'Avaliação, ensino e procedimentos pedagógicos'),
  ('Administrativo', 'Procedimentos internos');