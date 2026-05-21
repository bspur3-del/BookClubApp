# BookClubApp — Claude Instructions

## Deployment branch

**Railway watches: `claude/redeploy-awake-compassion-Njgln`**

Every change that should appear in production MUST be pushed to this branch.
New sessions are assigned a fresh feature branch — always cherry-pick or merge
completed work into `claude/redeploy-awake-compassion-Njgln` before finishing.

### Workflow for each session

1. Do all development work on the session's assigned feature branch.
2. When the work is done and pushed to the feature branch, also push it to the
   deployment branch so Railway picks it up:

```bash
# Cherry-pick the session's commits onto the deployment branch
git fetch origin claude/redeploy-awake-compassion-Njgln
git checkout -b deploy-branch origin/claude/redeploy-awake-compassion-Njgln
git cherry-pick <commit-sha> [<commit-sha> ...]
git push origin deploy-branch:claude/redeploy-awake-compassion-Njgln
```

Or, if the feature branch can be fast-forwarded:

```bash
git push origin <feature-branch>:claude/redeploy-awake-compassion-Njgln
```

Never skip this step — changes that only land on the feature branch will
never deploy.

## Tech stack

- Python / Flask
- SQLAlchemy + Flask-Migrate (Postgres on Railway, SQLite locally)
- Anthropic API (`claude-sonnet-4-6`) for recommendations, trivia, personality
- Gunicorn as the WSGI server (see `railway.json` / `Procfile`)
- Static assets in `static/`, Jinja2 templates in `templates/`

## Key files

| File | Purpose |
|---|---|
| `app.py` | Flask routes |
| `models.py` | SQLAlchemy models |
| `recommendations.py` | All Claude API calls (recommendations, trivia, personality) |
| `railway.json` | Railway start command (runs migrations then gunicorn) |
| `Dockerfile` | Used by Railway for builds |
| `migrations/` | Alembic migration files |
