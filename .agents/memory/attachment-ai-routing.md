---
name: Attachment AI routing
description: Provider selection for tutor messages that include image attachments
---

Keep the application's configured chat provider and model unchanged for normal chat and text-only document attachments. Route image-bearing turns through a separate lazy OpenAI client that uses `OPENAI_API_KEY`, with a vision-capable chat model.

**Why:** Image understanding needs a vision-capable provider, but switching the shared AI client would also change unrelated tutor and study features. The direct OpenAI key is intended for image handling without silently changing those features.

**How to apply:** Preserve this split unless the user explicitly asks to move the entire application to OpenAI or changes the provider configuration.