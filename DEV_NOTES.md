### Dev workflows
#### Setup
```
pnpm install
pnpm run playwright install
docker compose up -d
cd packages/test-worker
yarn run seed
```

#### Develop UI
```
pnpm run dev
SKIP_SETUP=true DASHBOARD_URL=http://localhost:3000 pnpm run playwright test --ui
```

#### Run all tests in parallel
```
cd apps/dashboard
yarn run build
cd ../../
pnpm run playwright test
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
