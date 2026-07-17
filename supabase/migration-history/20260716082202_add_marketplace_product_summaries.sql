create or replace function public.get_marketplace_product_summaries()
returns table (
  id uuid,
  expert_id uuid,
  expert_name text,
  expert_image_url text,
  title text,
  category text,
  summary text,
  sample_image_url text,
  starting_price integer,
  delivery_days integer,
  revision_count integer,
  created_at timestamptz,
  tax_invoice_available boolean,
  is_featured boolean,
  display_order integer,
  status text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    product.id,
    product.expert_id,
    coalesce(basic_profile.name, basic_profile.display_name, expert_profile.name, 'AI 전문가') as expert_name,
    coalesce(basic_profile.avatar_url, expert_profile.image_url, '') as expert_image_url,
    product.title,
    product.category,
    product.summary,
    case
      when coalesce(product.sample_file_urls[1], '') like 'data:%' then ''
      else coalesce(product.sample_file_urls[1], '')
    end as sample_image_url,
    product.starting_price,
    product.delivery_days,
    product.revision_count,
    product.created_at,
    product.tax_invoice_available,
    product.is_featured,
    product.display_order,
    product.status
  from public.expert_products as product
  left join public.profiles as basic_profile on basic_profile.id = product.expert_id
  left join public.expert_profiles as expert_profile on expert_profile.user_id = product.expert_id
  where product.status = 'published'
  order by product.created_at desc;
$$;

grant execute on function public.get_marketplace_product_summaries() to anon, authenticated;
