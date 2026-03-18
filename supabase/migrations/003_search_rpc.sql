create or replace function public.match_providers(
  query_embedding vector(1536),
  bairro_filter uuid default null,
  match_threshold float default 0.3,
  match_count int default 20
)
returns table (
  id uuid, name text, slug text, description_pt text,
  whatsapp text, home_bairro_id uuid, similarity float
)
language sql stable
as $$
  select
    p.id, p.name, p.slug, p.description_pt,
    p.whatsapp, p.home_bairro_id,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.providers p
  where
    p.status = 'active'
    and p.embedding is not null
    and 1 - (p.embedding <=> query_embedding) > match_threshold
    and (bairro_filter is null or p.home_bairro_id = bairro_filter)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
