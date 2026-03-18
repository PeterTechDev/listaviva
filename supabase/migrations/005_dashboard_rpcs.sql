-- Returns top search queries by frequency
create or replace function public.get_top_queries(limit_count int default 20)
returns table(query_text text, search_count bigint, avg_results numeric)
language sql stable as $$
  select query_text, count(*) as search_count, round(avg(results_count)::numeric, 1) as avg_results
  from public.search_queries
  group by query_text
  order by search_count desc
  limit limit_count;
$$;

-- Returns zero-result queries by frequency
create or replace function public.get_zero_result_queries(limit_count int default 20)
returns table(query_text text, search_count bigint)
language sql stable as $$
  select query_text, count(*) as search_count
  from public.search_queries
  where results_count = 0
  group by query_text
  order by search_count desc
  limit limit_count;
$$;

-- Returns categories ranked by provider scarcity (fewest providers first).
-- Pure supply-side view. Demand signal is zero-result queries (Search Analytics tab).
create or replace function public.get_supply_demand()
returns table(name_pt text, provider_count bigint)
language sql stable as $$
  select
    c.name_pt,
    coalesce(pc.provider_count, 0) as provider_count
  from public.categories c
  left join (
    select category_id, count(*) as provider_count
    from public.provider_categories
    group by category_id
  ) pc on c.id = pc.category_id
  order by provider_count asc;
$$;
