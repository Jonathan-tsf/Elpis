# LifeOS — Phase 2 (AI & Voice Journal) Implementation Plan

**Goal:** Transform the app from a manual logger into an AI-augmented life coach. The user can speak their day for 3-5 min and the AI fills in the journal. Morning briefings, conversational coach, deep analyses on demand, AI-generated daily quests.

**Architecture:** Same serverless stack. Adds Bedrock (Claude Sonnet 4.6 + Haiku 4.5) invoked from Lambda, AWS Transcribe for STT, EventBridge cron Lambdas for briefings + quest generation, and S3 events triggering an async voice-processor Lambda.

**Tech stack additions:** `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-transcribe`, `@aws-sdk/client-eventbridge` if needed. Prompt caching enabled. Tool-use with strict Zod-validated JSON schemas.

**Acceptance criteria — Phase 2 is done when:**
- [ ] I get a relevant morning briefing every day at 7h, displayed on the dashboard.
- [ ] I can chat with the coach at `/coach`; it sees my data via tool use and persists conversations.
- [ ] I can click "Analyse profonde" on a section and get a markdown report stored at `/rapports`.
- [ ] I can record a 3-min voice journal; transcription + parsing fills draft entries I review and confirm.
- [ ] Daily quests are AI-generated every morning (instead of hardcoded).
- [ ] All AI calls use prompt caching where applicable.

---

## Chunks

### P2-A — Bedrock client + Claude wrapper
- `apps/api/src/services/bedrock-client.ts`: `getBedrockRuntime()`, `invokeClaude({ model, system, messages, tools?, maxTokens? }): Promise<ClaudeResponse>`. Sets `anthropic_version`, `anthropic_beta` for prompt caching, handles tool_use loops.
- `apps/api/src/services/claude-models.ts`: model id constants (Sonnet 4.6, Haiku 4.5).
- Unit tests with mocked InvokeModelCommand.

### P2-B — Tool definitions (reading user data)
- `apps/api/src/services/ai-tools.ts`: exports a registry of `read_tools` Claude can call: `get_daily_logs(range_days)`, `get_workouts(range_days)`, `get_measurements(metrics?, range_days)`, `get_photos(tags?, range_days)`, `get_stats()`, `get_quests()`, `get_profile()`. Each tool has a JSON schema + handler that hits DynamoDB. Used by coach + deep-analysis.

### P2-C — Briefing route + cron
- `apps/api/src/services/briefing.ts`: pure prompt-builder + persister.
- Route: `GET /briefings/today` (returns latest), `POST /briefings/generate` (manual trigger).
- New CDK construct `briefing-cron.ts`: EventBridge rule firing daily at 07:00 UTC invoking a separate Lambda that calls `POST /briefings/generate` server-side (or invokes the same handler directly).
- Frontend: dashboard card "🌅 Briefing du matin" loading from `GET /briefings/today`.

### P2-D — Coach chat (Sonnet, tool use)
- `apps/api/src/routes/coach.ts`:
  - `POST /coach/threads` — create thread.
  - `POST /coach/threads/:id/messages` — send a user message; runs the tool-use loop (Claude may call read_tools multiple times); persists each user/assistant message; returns the assistant's final text.
  - `GET /coach/threads` — list threads.
  - `GET /coach/threads/:id/messages` — list messages.
- Storage: AiThread + AiMessage items in DynamoDB.
- Frontend `/coach`: chat UI (list of threads on the left, message stream on the right). Plain HTML/CSS, no library.

### P2-E — Deep analysis
- `POST /analysis/run` body `{ scope: 'sleep' | 'workouts' | 'looksmax' | 'global', days }` → bundles relevant data via tools, calls Sonnet with extended thinking, persists `AiAnalysisReport` (markdown), returns it.
- `GET /analysis` — list reports.
- `GET /analysis/:id` — fetch one.
- Frontend `/rapports`: list + detail view (markdown rendered with a simple lib like `marked` or react-markdown).

### P2-F — Voice journal pipeline
1. Frontend: in `/journal`, add a big "🎙️" button. On click: ask mic permission, record with MediaRecorder (webm/opus), stop button, blob ready.
2. POST `/voice-journal/presign` → presigned PUT URL into S3 voice bucket. Upload audio.
3. POST `/voice-journal` body `{ key, date }` → starts Transcribe job (fr-FR). Returns `{ jobId }`. The DailyLog item gets `voice_status: 'transcribing'`.
4. EventBridge rule: on Transcribe job completion, invokes a second Lambda `voice-processor`. It fetches the transcript, calls Claude Sonnet with a `parse_journal` tool that has writer tools (`log_sleep`, `log_mood`, etc.), accumulates the structured data, writes it to `daily_log.ai_drafts`, sets `voice_status: 'ready_for_review'`.
5. Frontend polls `GET /daily-log/:date/draft-status` every 2s. When ready, displays the drafts in a "Revue" screen with checkboxes; user validates → POST to `/daily-log/:date/commit-drafts`.

### P2-G — AI-generated daily quests
- Replace the hardcoded `DAILY_QUESTS` evaluation flow with: a daily EventBridge cron at 06:00 UTC that calls Haiku with the recent data + user goals, gets back a JSON of 3-5 quests, validates with Zod, writes them as `Quest` items with `period: 'daily'` and a `due_at` of midnight.
- Existing `/quests` route reads them from DynamoDB instead of the hardcoded list.

### P2-H — Prompt caching
- All Claude calls use prompt caching on the system prompt + the user profile + stats snapshot fixture. Verify costs in CloudWatch.

### P2-I — Frontend polish
- Coach UI streaming display (server-sent events optional, otherwise full reply).
- Markdown rendering on rapports.
- "Analyser cette section" button on each domain page.

---

## Risks

- Bedrock cross-region: us-east-1 region we're in has Claude. No cross-region needed for now.
- Transcribe job-completion event: the cleanest way is `events.PutRule` on `transcribe.amazonaws.com` with `source: ['aws.transcribe']` and detail-type `'Transcribe Job State Change'`. Verify it's available in us-east-1.
- Voice processor cold start: keep bundle minimal.
- Token bills: enable prompt caching + budget alert at 30€/mo.

---
