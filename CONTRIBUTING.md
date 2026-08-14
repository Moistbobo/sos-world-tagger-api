# Contributing

## Pull Request Templates

This repo has two PR templates. Use the correct one based on your target branch:

| Template | File | When to use |
|---|---|---|
| Default | `.github/PULL_REQUEST_TEMPLATE.md` | PRs targeting `main` |
| Release | `.github/PULL_REQUEST_TEMPLATE/release.md` | PRs targeting `release` |

GitHub always pre-fills the default template. For release PRs, select `release.md` from the "Add a template" dropdown when opening the PR, or copy its contents manually.

## Branch Naming Convention

```
<verb>/<issue-number>/<human-readable-description>
```

If no issue maps to the branch, omit the issue number:

```
<verb>/<human-readable-description>
```

Examples:

```
feat/54/add-world-tags-endpoint
chore/88/add-test-script
fix/102/correct-pagination-offset
docs/update-readme
refactor/simplify-world-service
```

## Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `ci`, `test`, `style`.

Examples:

```
feat: add world tags endpoint
fix: correct pagination offset
docs: update API authentication instructions
chore: upgrade dependencies
```

## Pull Request Title Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `ci`, `test`, `style`.

Examples:

```
feat: add world tags endpoint
fix: correct pagination offset
docs: update API authentication instructions
chore: upgrade dependencies
refactor: simplify world service
ci: fix deployment workflow
test: add integration tests for tag filtering
```

## Issue Templates

Use `.github/ISSUE_TEMPLATE/ticket.md` when filing issues. It supports bugs, features, and chores in a single form.

### Previs for UI/UX tickets

If a ticket touches UI/UX, include a visual previs:

1. Create a self-contained HTML file with inlined CSS/images.
2. Upload it as a [GitHub Gist](https://gist.github.com).
3. Embed it using the Hyouji HTML renderer: `https://www.hyouji.moe/?gist=https://gist.github.com/<user>/<gist-id>`
