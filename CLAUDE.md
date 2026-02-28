# Flytrap — Claude Code Project Context

## What This Is

Cultural Forecaster ("Flytrap") — a predictive cultural intelligence system. Python pipeline collects signals from 7 sources, processes them with Claude, stores in Notion, displays on a Next.js dashboard. See `SYSTEM.md` for full architecture.

## Project Structure

```
scripts/           Python pipeline (collectors, processors, agents)
dashboard/         Next.js 14 App Router (Vercel)
.claude/agents/    Claude Code agent configs (7 agents)
.github/workflows/ GitHub Actions (pipeline, agent tasks, agent autonomy)
data/              Local data files (velocity tracking, etc.)
```

## Conventions

### Dashboard (TypeScript/React)
- **Inline CSS only** — no Tailwind, no CSS modules. Use `style={{}}` props.
- **CSS variables** for theming: `var(--text-primary)`, `var(--surface)`, `var(--border)`, `var(--bg)`, etc.
- **Dark mode first** — always use CSS variables, never hardcode colors.
- **TypeScript strict** — run `npx tsc --noEmit` to verify.
- **No external UI libraries** — everything is hand-built components.

### Python Pipeline
- **Python 3.11** — venv in `venv/`, deps in `requirements.txt`
- **Notion as database** — all persistent data lives in Notion DBs
- **Claude for processing** — Sonnet for daily processing, Opus for briefings

### Git & PRs
- No git remote configured locally — code deploys via `vercel --prod`
- GitHub Actions run from the remote repo
- Agent PRs use branch prefix `agent/<agent-name>/`

## Agent System

7 Claude Code agents defined in `.claude/agents/`:

| Agent | Domain | Allowed Files |
|-------|--------|---------------|
| Sentinel | Oversight, quality, PR review | All (read), SYSTEM.md |
| Scout | Source collection, health | `scripts/collectors/` |
| Oracle | Predictions, calibration | `scripts/processors/` |
| Architect | Dashboard UI, components | `dashboard/` |
| Optimize | Cost, performance, ops | `scripts/`, `.github/workflows/` |
| Strategist | Briefings, cultural intel | `scripts/processors/briefing_generator.py` |
| Isabel | Office visualization, decor | `dashboard/components/pixel-office/` |

### Agent Automation Rules

When running autonomously via GitHub Actions:
1. **Stay in scope** — only modify files in your domain (see table above)
2. **Small changes** — 2-4 focused modifications per run, not rewrites
3. **Verify** — run `npx tsc --noEmit` (dashboard) or `python -m py_compile` (Python) before committing
4. **Describe changes** — PR descriptions must explain what changed and why
5. **No secrets** — never commit .env files, API keys, or tokens
