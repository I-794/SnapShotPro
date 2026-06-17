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
- Skills: brandkit, brutalist-skill (industrial-brutalist-ui), gpt-tasteskill (gpt-taste),
  image-to-code-skill (image-to-code), imagegen-frontend-mobile, imagegen-frontend-web,
  minimalist-skill (minimalist-ui), output-skill (full-output-enforcement),
  redesign-skill (redesign-existing-projects), soft-skill (high-end-visual-design),
  stitch-skill (stitch-design-taste), taste-skill (design-taste-frontend),
  taste-skill-v1 (design-taste-frontend-v1)
- Note: these are frontend design-taste skills oriented toward React/Tailwind/component
  libraries. They are available on-demand but do not auto-apply; this repo is vanilla JS
  (see CLAUDE.md), so invoke them deliberately when relevant.

These were vendored directly into `.claude/skills/` (rather than installed via the
Claude Code plugin marketplace) so they are version-controlled and available to all
sessions on this repo, including Claude Code on the web.
