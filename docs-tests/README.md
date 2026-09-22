# Documentation checks

From this directory:

```sh
npm ci --ignore-scripts --legacy-peer-deps
npm test
```

The isolated fixture pins released dependencies, not local source. It validates
context7.json against the fetched official schema. For repositories with a marked
README example it extracts that block, runs a strict TypeScript check (skipping
external declaration checking), then runs a targeted smoke test. It is not the
full package suite, an exhaustive peer compatibility matrix, or an index refresh.
The registry lockfile records transitive versions. Peer auto-installation is
disabled so the tested combination stays explicit. Public network access is
needed for npm installation and the Context7 schema read.
