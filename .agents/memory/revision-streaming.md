---
name: Revision Mode streaming
description: SSE chunk format for the revision stream endpoint
---

# Revision Mode Streaming

The `/api/openai/revision-stream` endpoint (POST) uses the same SSE chunk format as the existing tutor endpoint:

```
data: {"content": "<delta>"}\n\n
data: {"done": true}\n\n
```

NOT the OpenAI-style `{"choices":[{"delta":{"content":"..."}}]}` format.

The frontend (`revision.tsx`) parses `parsed.content` and checks `parsed.done`.

**Why:** Consistency with existing `/api/openai/conversations/:id/messages` SSE endpoint. Simpler to parse on the client.
