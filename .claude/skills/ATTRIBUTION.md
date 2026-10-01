# Skill Attribution

The following skills were installed from third-party sources.

## superpowers
- Source: https://github.com/obra/superpowers
- Author: Jesse Vincent (obra)
- License: MIT (see `LICENSE.superpowers`)
- Version: 6.0.1 (commit a21956e)
- Installed: 2026-06-17
- Skills: brainstorming, dispatching-parallel-agents, executing-plans,
  finishing-a-development-branch, receiving-code-review, requesting-code-review,
  subagent-driven-development, systematic-debugging, test-driven-development,
  using-git-worktrees, using-superpowers, verification-before-completion,
  writing-plans, writing-skills

## taste-skill
- Source: https://github.com/Leonxlnx/taste-skill
- Author: leonxlnx
- License: MIT (see `LICENSE.taste-skill`)
- Version: 1.0.0 (commit 01d8504)
- Installed: 2026-06-17
- Skills: brandkit, output-skill (full-output-enforcement),
  redesign-skill (redesign-existing-projects)
- Removed 2026-10-01 (overlapping, mostly React/Tailwind-oriented, gave conflicting style
  rules): brutalist-skill, gpt-tasteskill, image-to-code-skill, imagegen-frontend-mobile,
  imagegen-frontend-web, minimalist-skill, soft-skill, stitch-skill, taste-skill,
  taste-skill-v1. `redesign-skill` is kept as the single design skill (works with vanilla
  CSS); use it for the marketing pages, not the editor.

These were vendored directly into `.claude/skills/` (rather than installed via the
Claude Code plugin marketplace) so they are version-controlled and available to all
sessions on this repo, including Claude Code on the web.
