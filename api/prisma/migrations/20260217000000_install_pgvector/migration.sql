-- Install pgvector extension for vector similarity search
-- Required for tasks.embedding and products.embedding columns

CREATE EXTENSION IF NOT EXISTS vector;
