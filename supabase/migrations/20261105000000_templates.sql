-- Detail templates (Phase 6): a recipe content type, and what each template shows beyond the card
-- (article byline and date, video provider and id, recipe ingredients and steps). Null for older links.
-- Apply before deploying the template clients. Both statements are safe to rerun.
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'recipe';
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS template_data jsonb;
