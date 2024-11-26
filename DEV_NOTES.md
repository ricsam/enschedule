### Dev workflows
#### Setup
```
pnpm install
npm run playwright install
docker compose up -d
echo 'POSTGRES=postgres://postgres:postgres@127.0.0.1:6543/dev\nAPI_KEY=secret_key\nPORT=3333' > tests/test-worker/.env
pnpm run --filter test-worker seed

brew install pstree
```

#### Develop UI
```
echo 'WORKER_URL=http://localhost:3333\nAPI_KEY=secret_key' > apps/dashboard/.env

npm run dev
SKIP_SETUP=true DASHBOARD_URL=http://localhost:3000 pnpm run playwright test --ui
```

#### Run all tests in parallel
```
pnpm run --filter @enschedule/dashboard build
npm run playwright test
```

##### To kill any lingering processes, run:
```bash
# Get $PID by pstree | grep 'enschedule/node_modules/.pnpm/turbo'
kill -- -$(ps -o pgid= $PID | grep -o '[0-9]*')
```

# Hub to work with package.json
* pg-driver
* types
* worker-api
* worker must have main field that points to "./dist/index.js"


# Publishing
```bash
npm run build
node ./release-package.js # during dev some packages have their main field point to ts files to aid when jumping to definition in vscode. When publishing to npm it is important that these fields change to pointing at the files in the dist folders. Done using release-package.js script
npx changeset # create the new changelog
gst | grep modified | grep package.json | awk '{ print $2  }' | xargs git checkout --
npx changeset version # update the package.json files
git add .
git commit -m "new major version for npm packages to integrate authorization and authentication with api keys and sessions"
git push
```

if a version is bumped it will be published in the pipeline


# Testing before pushing
```
pnpm lint
pnpm typecheck
pnpm run --filter=@enschedule/types --filter=@enschedule/cli test
TEST_DIALECT=pg pnpm run --filter=@enschedule/pg-driver test
TEST_DIALECT=sqlite pnpm run --filter=@enschedule/pg-driver test
```

## Playwright tests
```
npm run playwright install
pnpm run --filter test-worker seed
pnpm run --filter @enschedule/dashboard build
SKIP_SETUP=true DASHBOARD_URL=http://localhost:3000 pnpm run playwright test --ui
```

## Build images to test container locally
```
./infrastructure/build-images.sh
docker container run -itd --rm \
  --name enschedule-dashboard \
  -e SQLITE=":memory:" \
  -e IMPORT_HANDLERS="@enschedule/fetch-handler,@enschedule/log-handler" \
  -e ACCESS_TOKEN_SECRET=secret_key \
  -e REFRESH_TOKEN_SECRET=secret_key \
  -e COOKIE_SESSION_SECRET=s3cr3t \
  -e ADMIN_ACCOUNT=ricsam:password \
  -p 3333:3000 \
  ghcr.io/ricsam/enschedule-dashboard:alpha
```

## Utils
```
TEST_UTILS=true SKIP_SETUP=true DASHBOARD_URL=http://localhost:3000 pnpm run playwright test --grep create_many_runs
```

## Debug playwright in the UI
```bash
npm run playwright show-report '~/Downloads/playwright-report (1)'
```
