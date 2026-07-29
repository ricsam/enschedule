# Enschedule documentation

This directory is an independent [Mintlify](https://mintlify.com) documentation project for Enschedule.

## Preview

The current Mintlify CLI requires Node.js 20.17 or later.

```bash
npm install --global mint
cd website
mint dev
```

Open `http://localhost:3000`.

## Validate

```bash
cd website
mint validate
mint broken-links --check-anchors
mint a11y
```

## Update the API reference

Generate `openapi.json` from the same Richie RPC contract used by the dashboard:

```bash
bun run --cwd website openapi:generate
```

Then run `mint validate` from this directory.

## Deploy from this monorepo

Connect `ricsam/enschedule` in Mintlify Git Settings and set the docs subdirectory to `website`. Mintlify deploys changes when the configured branch is pushed.
