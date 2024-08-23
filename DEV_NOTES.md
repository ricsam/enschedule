### Dev workflows
#### Setup
```
pnpm install
npm run playwright install
docker compose up -d
cd tests/test-worker
echo 'POSTGRES=postgres://postgres:postgres@127.0.0.1:6543/dev\nAPI_KEY=secret_key\nPORT=3333' > .env
npm run seed

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
cd apps/dashboard
npm run build
cd ../../
npm run playwright test
```

##### To kill any lingering processes, run:
```bash
# Get $PID by pstree | grep 'enschedule-2/node_modules/.pnpm/turbo'
kill -- -$(ps -o pgid= $PID | grep -o '[0-9]*')
```

# Hub to work with package.json
* pg-driver
* types
* worker-api
* worker must have main field that points to "./dist/index.js"


# Publishing
```bash
npx changeset # create the new changelog
npx changeset version # update the package.json files
```

if a version is bumped it will be published in the pipeline
