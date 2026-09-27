-- Smart Assistant chat history
-- Safe additive migration: no existing table or data is removed.

CREATE TABLE IF NOT EXISTS public.assistant_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_chat_messages_session_created
  ON public.assistant_chat_messages (session_id, created_at ASC);

COMMENT ON TABLE public.assistant_chat_messages IS
  'Conversation history for the in-app Dapur Tracker Smart Assistant.';
