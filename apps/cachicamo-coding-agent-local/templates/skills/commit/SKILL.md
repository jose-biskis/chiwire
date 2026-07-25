---
name: commit
description: Create a git commit using the repo's commit message style when the user asks to commit.
---

# Commit skill

Only run when the user explicitly asks to commit.

1. Run `git status`, `git diff`, and `git log -5 --oneline` in parallel.
2. Stage relevant files (never secrets).
3. Commit with a concise why-focused message via HEREDOC.
4. Show `git status` afterward.
5. Do not push unless asked.
