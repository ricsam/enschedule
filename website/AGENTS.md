# Enschedule documentation instructions

## About this project

- This is a Mintlify documentation site for Enschedule 2.
- Pages are MDX files with YAML frontmatter.
- Site configuration lives in `docs.json`.
- The OpenAPI specification is generated with `bun run openapi:generate`.

## Terminology

- Use **function** or **function definition** for registered job code.
- Use **worker** for a Bun process that registers functions and polls PostgreSQL.
- Use **schedule** for stored timing, payload, and retry policy.
- Use **run** for one execution attempt.
- Explain `eventId` as a stable schedule name when it first appears.

## Style

- Use active voice and second person.
- Use sentence case for headings.
- Keep commands copyable and include required context.
- Format paths, commands, files, variables, statuses, and code symbols with backticks.
- Use **bold** for dashboard controls.

## Content boundaries

- Document Enschedule 2 with Bun and PostgreSQL only.
- Use `/api` as the API base path.
- Do not present `/api/v1`, SQLite, Sequelize, Umzug, Remix, or Express as supported runtime paths.
- Never include production secrets or recommend example credentials for production.
