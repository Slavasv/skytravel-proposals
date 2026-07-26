alter table public.proposals
  add column country_ru text,
  add column country_en text;

alter table public.proposal_variants
  add column overview_ru text,
  add column overview_en text;