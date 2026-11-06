-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4: wardrobe & stylist chat refinements
-- ═══════════════════════════════════════════════════════════════════════

-- Wardrobe items get an updated_at for "recently edited" ordering.
alter table public.wardrobe_items add column updated_at timestamptz not null default now();
create trigger wardrobe_items_updated_at before update on public.wardrobe_items
  for each row execute function public.set_updated_at();
create index wardrobe_items_user_created_idx on public.wardrobe_items (user_id, created_at desc);

-- Conversations are ordered by latest activity.
alter table public.chat_conversations add column updated_at timestamptz not null default now();
create index chat_conversations_user_updated_idx on public.chat_conversations (user_id, updated_at desc);

-- Messages are written by the server (after validation, usage limits and the
-- AI call). Users can only read them, and only in their own conversations.
-- Users may not edit conversations except via delete.
drop policy "own conversations updatable" on public.chat_conversations;
drop policy "own conversations insertable" on public.chat_conversations;

-- Users may only set an image path inside their own wardrobe folder.
alter table public.wardrobe_items add constraint wardrobe_image_path_owner
  check (image_path is null or image_path like (user_id::text || '/wardrobe/%'));
