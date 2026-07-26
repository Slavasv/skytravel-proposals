-- ============================================================
-- 0023: Блок «Впечатления» у варианта
-- Дата: июль 2026
-- Зачем: у каждого варианта своя секция «Впечатления» перед маршрутом:
--   gallery (jsonb, уже есть в 0022) — фото с подписями [{id,image_url,caption_ru,caption_en}]
--   impressions_text_ru/en — впечатляющий текст под галереей
--   divider_image — одно фото-дивайдер на всю ширину
-- Статус: накачено на STAGING. На PROD — НЕТ.
-- ============================================================

alter table public.proposal_variants
  add column impressions_text_ru text,
  add column impressions_text_en text,
  add column divider_image text;