-- supabase/migrations/004_recommendations_category.sql
alter table public.recommendations
  add column category_id uuid references public.categories on delete set null;
