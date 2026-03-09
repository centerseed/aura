CREATE TABLE IF NOT EXISTS naru_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_naru_memories_user_id ON naru_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_naru_memories_embedding ON naru_memories
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
