# Getting LLM API Keys

MarkItDown UI can use **Anthropic Claude** or **OpenAI GPT-5 mini** to generate
AI-powered descriptions for image files (PNG, JPG, GIF, BMP, WEBP).  
If neither key is set, images are still converted but without AI descriptions.

---

## Anthropic Claude (Recommended)

Claude is used when `ANTHROPIC_API_KEY` is set in `backend/.env`.  
Default model: `claude-haiku-4-5-20251001` (fast, cheap — override with `CLAUDE_MODEL`).

### Steps

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up or log in.
2. Click **API Keys** in the left sidebar (or go to
   [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)).
3. Click **Create Key**, give it a name (e.g. `markitdownui`), and copy the key.  
   > ⚠️ The key is only shown once — save it immediately.
4. Add it to `backend/.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   # Optional – override the default model (see table below):
   # CLAUDE_MODEL=claude-haiku-4-5-20251001
   ```

### Available Claude Models (as of early 2026)

Source: [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview)

| Model | API ID | Input | Output | Best for |
|-------|--------|-------|--------|----------|
| **Haiku 4.5** ⭐ default | `claude-haiku-4-5-20251001` | $1 / MTok | $5 / MTok | Fast, low-cost image descriptions |
| Sonnet 4.6 | `claude-sonnet-4-6` | $3 / MTok | $15 / MTok | Balanced quality + speed |
| Opus 4.6 | `claude-opus-4-6` | $5 / MTok | $25 / MTok | Best quality, complex reasoning |

MTok = million tokens.  
A typical image description costs roughly **300–800 input + 100–300 output tokens**.  
With Haiku 4.5 that's under **$0.001 per image**.

See full, up-to-date pricing at [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing).

---

## OpenAI GPT-5 mini (Fallback)

OpenAI is used when `OPENAI_API_KEY` is set **and** `ANTHROPIC_API_KEY` is not.  
Default model: `gpt-5-mini` (override with `OPENAI_MODEL`).

### Steps

1. Go to [platform.openai.com](https://platform.openai.com) and sign up or log in.
2. Open the **API Keys** page:
   [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. Click **Create new secret key**, give it a name (e.g. `markitdownui`), and copy
   the key.  
   > ⚠️ The key is only shown once — save it immediately.
4. Make sure your account has a **positive credit balance** at
   [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)
   (new accounts get a free trial credit).
5. Add it to `backend/.env`:
   ```env
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   # Optional – override the default model:
   # OPENAI_MODEL=gpt-5-mini
   ```

### Available OpenAI Models (as of early 2026)

Source: [openai.com/api/pricing/](https://openai.com/api/pricing/)

| Model | Input | Output | Best for |
|-------|-------|--------|----------|
| **GPT-5 mini** ⭐ default | $0.25 / MTok | $2.00 / MTok | Fast, cheap vision descriptions |
| GPT-5.2 | $1.75 / MTok | $14.00 / MTok | Balanced quality |
| GPT-5.2 pro | $21.00 / MTok | $168.00 / MTok | Maximum quality |

With GPT-5 mini a typical image description costs under **$0.001 per image**.

---

## Priority Order

```
ANTHROPIC_API_KEY set?  → Use Claude (default: claude-haiku-4-5-20251001)
  ↓ no
OPENAI_API_KEY set?     → Use OpenAI GPT-5 mini
  ↓ no
                        → Plain MarkItDown (no AI image descriptions)
```

---

## Full `backend/.env` Example

```env
# --- Anthropic Claude (priority 1) ---
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Choose your model (default is Haiku 4.5 — fast and cheap):
# CLAUDE_MODEL=claude-haiku-4-5-20251001   ← fast, cheapest
# CLAUDE_MODEL=claude-sonnet-4-6           ← balanced
# CLAUDE_MODEL=claude-opus-4-6             ← best quality

# --- OpenAI (priority 2, used only if Anthropic key is absent) ---
# OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# OPENAI_MODEL=gpt-5-mini     ← default (fast, cheap)
# OPENAI_MODEL=gpt-5.2        ← better quality

# --- Logging ---
# LOG_LEVEL=INFO
```

Copy `backend/.env.example` to `backend/.env` and fill in your key(s).

---

## Security Reminders

- **Never commit** `backend/.env` to version control — it is already listed in `.gitignore`.
- Rotate keys immediately if accidentally exposed.
- Both providers let you set **usage limits / alerts** in their dashboards — recommended for local dev use.

### Steps

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up or log in.
2. Click **API Keys** in the left sidebar (or go to
   [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)).
3. Click **Create Key**, give it a name (e.g. `markitdownui`), and copy the key.  
   > ⚠️ The key is only shown once — save it immediately.
4. Add it to `backend/.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   # Optional – override the default model (see table below):
   # CLAUDE_MODEL=claude-haiku-4-5-20251001
   ```

### Available Claude Models (as of early 2026)

Source: [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview)

| Model | API ID | Input | Output | Best for |
|-------|--------|-------|--------|----------|
| **Haiku 4.5** ⭐ default | `claude-haiku-4-5-20251001` | $1 / MTok | $5 / MTok | Fast, low-cost image descriptions |
| Sonnet 4.6 | `claude-sonnet-4-6` | $3 / MTok | $15 / MTok | Balanced quality + speed |
| Opus 4.6 | `claude-opus-4-6` | $5 / MTok | $25 / MTok | Best quality, complex reasoning |

MTok = million tokens.  
A typical image description costs roughly **300–800 input + 100–300 output tokens**.  
With Haiku 4.5 that's under **$0.001 per image**.

See full, up-to-date pricing at [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing).

---

## OpenAI GPT-4o (Fallback)

OpenAI is used when `OPENAI_API_KEY` is set **and** `ANTHROPIC_API_KEY` is not.  
Default model: `gpt-4o` (override with `OPENAI_MODEL`).

### Steps

1. Go to [platform.openai.com](https://platform.openai.com) and sign up or log in.
2. Open the **API Keys** page:
   [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. Click **Create new secret key**, give it a name (e.g. `markitdownui`), and copy
   the key.  
   > ⚠️ The key is only shown once — save it immediately.
4. Make sure your account has a **positive credit balance** at
   [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)
   (new accounts get a free trial credit).
5. Add it to `backend/.env`:
   ```env
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   # Optional – override the default model:
   # OPENAI_MODEL=gpt-4o
   ```

### Pricing (as of early 2026)

| Direction | GPT-4o |
|-----------|--------|
| Input     | $2.50 / MTok |
| Output    | $10.00 / MTok |

See current pricing at [openai.com/api/pricing](https://openai.com/api/pricing).

---

## Priority Order

```
ANTHROPIC_API_KEY set?  → Use Claude (default: claude-haiku-4-5-20251001)
  ↓ no
OPENAI_API_KEY set?     → Use OpenAI GPT-4o
  ↓ no
                        → Plain MarkItDown (no AI image descriptions)
```

---

## Full `backend/.env` Example

```env
# --- Anthropic Claude (priority 1) ---
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Choose your model (default is Haiku 4.5 — fast and cheap):
# CLAUDE_MODEL=claude-haiku-4-5-20251001   ← fast, cheapest
# CLAUDE_MODEL=claude-sonnet-4-6           ← balanced
# CLAUDE_MODEL=claude-opus-4-6             ← best quality

# --- OpenAI GPT-4o (priority 2, used only if Anthropic key is absent) ---
# OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# OPENAI_MODEL=gpt-4o

# --- Logging ---
# LOG_LEVEL=INFO
```

Copy `backend/.env.example` to `backend/.env` and fill in your key(s).

---

## Security Reminders

- **Never commit** `backend/.env` to version control — it is already listed in `.gitignore`.
- Rotate keys immediately if accidentally exposed.
- Both providers let you set **usage limits / alerts** in their dashboards — recommended for local dev use.

### Steps

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up or log in.
2. Click **Get API Keys** in the left sidebar (or navigate to
   [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)).
3. Click **Create Key**, give it a name (e.g. `markitdownui`), and copy the key.  
   > ⚠️ The key is only shown once — save it immediately.
4. Add it to `backend/.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   # Optional – override the default model:
   # CLAUDE_MODEL=claude-3-5-sonnet-20241022
   ```

### Pricing (as of early 2026)
Claude 3.5 Sonnet charges per token:

| Direction | Cost |
|-----------|------|
| Input     | $3.00 / 1M tokens |
| Output    | $15.00 / 1M tokens |

A typical image description costs roughly **300–800 input tokens + 100–300 output
tokens** (< $0.005 per image).  
See current pricing at [anthropic.com/pricing](https://www.anthropic.com/pricing).

---

## OpenAI GPT-4o (Fallback)

OpenAI is used when `OPENAI_API_KEY` is set **and** `ANTHROPIC_API_KEY` is not.  
Default model: `gpt-4o` (override with `OPENAI_MODEL`).

### Steps

1. Go to [platform.openai.com](https://platform.openai.com) and sign up or log in.
2. Open the **API Keys** page:
   [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. Click **Create new secret key**, give it a name (e.g. `markitdownui`), and copy
   the key.  
   > ⚠️ The key is only shown once — save it immediately.
4. Make sure your account has a **positive credit balance** at
   [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing)
   (new accounts get a free trial credit).
5. Add it to `backend/.env`:
   ```env
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   # Optional – override the default model:
   # OPENAI_MODEL=gpt-4o
   ```

### Pricing (as of early 2026)
GPT-4o charges per token:

| Direction | Cost |
|-----------|------|
| Input     | $2.50 / 1M tokens |
| Output    | $10.00 / 1M tokens |

See current pricing at [openai.com/api/pricing](https://openai.com/api/pricing).

---

## Priority Order

```
ANTHROPIC_API_KEY set?  → Use Claude
  ↓ no
OPENAI_API_KEY set?     → Use OpenAI GPT-4o
  ↓ no
                        → Plain MarkItDown (no AI image descriptions)
```

---

## Full `backend/.env` Example

```env
# --- Anthropic Claude (priority 1) ---
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# CLAUDE_MODEL=claude-3-5-sonnet-20241022

# --- OpenAI GPT-4o (priority 2, used only if Anthropic key is absent) ---
# OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# OPENAI_MODEL=gpt-4o

# --- Logging ---
# LOG_LEVEL=INFO
```

Copy `backend/.env.example` to `backend/.env` and fill in your key(s).

---

## Security Reminders

- **Never commit** `backend/.env` to version control — it is already listed in `.gitignore`.
- Rotate keys immediately if accidentally exposed.
- Both providers let you set **usage limits / alerts** in their dashboards — recommended for local dev use.
