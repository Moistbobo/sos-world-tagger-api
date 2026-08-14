<!--
  Use this template for PRs targeting the release branch `release`.
  GitHub will not automatically select a template by target branch; pick this template
  from the PR creation dropdown (or open this file and copy its contents) when opening
  a release PR.
-->

## Summary

-

## Incoming commits

<!--
  List every commit that is part of this release PR.
  Format each item as:

    - `<short-sha>` commit message ([commit message #NN](https://github.com/Moistbobo/sos-world-tagger-api/pull/NN))

  Tip: generate the short-SHA/message list with:

    git log --reverse --pretty=format:"- \`%h\` %s" <target-branch>..<source-branch>
-->

- `<short-sha>` commit message
- `<short-sha>` commit message ([commit message #NN](https://github.com/Moistbobo/sos-world-tagger-api/pull/NN))
- `<short-sha>` commit message ([commit message #NN](https://github.com/Moistbobo/sos-world-tagger-api/pull/NN))

## Verification checklist

- [ ] `pnpm test` passes.
- [ ] `pnpm lint` is clean.
- [ ] `pnpm start` boots without errors.
- [ ] Release branch diff reviewed for unexpected changes.
- [ ] No new errors in server logs (`tslog.log`).
- [ ] DB migrations/schema changes verified against a fresh or migrated database.
- [ ] Endpoint smoke test against the deployed environment (healthcheck + one core flow).
