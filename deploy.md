# Deploying Enschedule

These instructions deploy Enschedule to the managed Kubernetes vCluster. The current installation is a single-Pod Helm release with PostgreSQL, the worker, and the dashboard in one Pod.

## Current deployment

- Namespace: `enschedule-stack-migration`
- Helm release: `enschedule`
- Chart: `infrastructure/charts/enschedule`
- Public URL: <https://enschedule-irqfaf85i4ig.r5d.app>
- Dashboard image: `ghcr.io/ricsam/enschedule-dashboard`
- Worker image: `ghcr.io/ricsam/enschedule-worker`

The PostgreSQL and worker-log PVCs use `rook-ceph-block`. Do not deploy this application into the `default` namespace, change the PVCs to node-local storage, or add `subPath` volume mounts.

## Prerequisites

The deployment shell must have Docker, Bun, Helm, `kubectl`, a valid `KUBECONFIG`, and GHCR push credentials. Confirm access before making changes:

```bash
kubectl get namespace enschedule-stack-migration
kubectl -n enschedule-stack-migration get deployment,pod,service,ingress,pvc
kubectl -n enschedule-stack-migration get secret ghcr-pull
```

Set the deployment variables:

```bash
export NAMESPACE=enschedule-stack-migration
export RELEASE=enschedule
export CHART=infrastructure/charts/enschedule
export REGISTRY="${R5D_GHCR_REGISTRY:-${GHCR_REGISTRY:-ghcr.io}}"
export REGISTRY_NAMESPACE="${R5D_GHCR_NAMESPACE:-${GHCR_NAMESPACE:-ricsam}}"
export IMAGE_TAG="$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"
export DASHBOARD_IMAGE="${REGISTRY}/${REGISTRY_NAMESPACE}/enschedule-dashboard"
export PUBLIC_URL=https://enschedule-irqfaf85i4ig.r5d.app
```

Docker builds from the working tree, including uncommitted files. Check `git status` and make sure the intended source is present before building.

## Deploy a dashboard change

This is the normal path for frontend or dashboard-backend changes. It leaves the worker image and persistent data unchanged.

### 1. Verify and build

```bash
bun install --frozen-lockfile
bun run --cwd apps/dashboard typecheck
bun run --cwd apps/dashboard build

docker build \
  --target dashboard \
  --tag "${DASHBOARD_IMAGE}:${IMAGE_TAG}" \
  .
```

### 2. Push to GHCR

Use the Docker credential configuration supplied by the worker. Verify login if the push is rejected:

```bash
docker push "${DASHBOARD_IMAGE}:${IMAGE_TAG}"
```

If the namespace does not already have a working `ghcr-pull` secret, create or update it from a valid Docker configuration file:

```bash
export AUTH_FILE="${R5D_GHCR_AUTH_FILE:-${REGISTRY_AUTH_FILE:-$HOME/.docker/config.json}}"

kubectl -n "$NAMESPACE" create secret generic ghcr-pull \
  --type=kubernetes.io/dockerconfigjson \
  --from-file=.dockerconfigjson="$AUTH_FILE" \
  --dry-run=client -o yaml > /tmp/enschedule-ghcr-pull.yaml

kubectl apply --dry-run=server -f /tmp/enschedule-ghcr-pull.yaml
kubectl apply -f /tmp/enschedule-ghcr-pull.yaml
rm -f /tmp/enschedule-ghcr-pull.yaml
```

### 3. Update the Helm release

Use Helm rather than only running `kubectl set image`; this keeps Helm's stored image tag in sync and prevents a future Helm operation from restoring an older image. `--reuse-values` retains the release's existing secrets, worker image, ingress, and single-Pod settings.

First perform a server-side dry run with the exact upgrade arguments:

```bash
helm lint "$CHART"

helm upgrade "$RELEASE" "$CHART" \
  --namespace "$NAMESPACE" \
  --reuse-values \
  --set-string dashboard.image.repository="$DASHBOARD_IMAGE" \
  --set-string dashboard.image.tag="$IMAGE_TAG" \
  --dry-run=server \
  --hide-secret
```

If the dry run has no errors, deploy:

```bash
helm upgrade "$RELEASE" "$CHART" \
  --namespace "$NAMESPACE" \
  --reuse-values \
  --set-string dashboard.image.repository="$DASHBOARD_IMAGE" \
  --set-string dashboard.image.tag="$IMAGE_TAG" \
  --wait \
  --timeout 10m
```

The Deployment uses the `Recreate` strategy because its single Pod mounts `ReadWriteOnce` volumes, so expect brief downtime during rollout.

## Verify the deployment

Do not treat a successful apply or Helm command as sufficient. Wait for the workload, inspect the Pod and events, then check the public endpoint:

```bash
kubectl -n "$NAMESPACE" rollout status deployment/enschedule --timeout=10m
kubectl -n "$NAMESPACE" get pods -l app.kubernetes.io/name=enschedule -o wide
kubectl -n "$NAMESPACE" get deployment enschedule \
  -o jsonpath='{.status.readyReplicas}/{.status.replicas}{" ready\n"}{.spec.template.spec.containers[?(@.name=="dashboard")].image}{"\n"}'

POD="$(kubectl -n "$NAMESPACE" get pod \
  -l app.kubernetes.io/name=enschedule \
  -o jsonpath='{.items[0].metadata.name}')"

kubectl -n "$NAMESPACE" logs "$POD" -c dashboard --tail=100
kubectl -n "$NAMESPACE" logs "$POD" -c worker --tail=100
kubectl -n "$NAMESPACE" get events --sort-by=.lastTimestamp | tail -25

curl --fail --show-error --silent "${PUBLIC_URL}/healthz"
curl --fail --show-error --silent "${PUBLIC_URL}/" > /dev/null
```

For visual changes, open the public URL and verify both light and dark modes. The public URL must use HTTPS; Cloudflare terminates public TLS, so the Kubernetes Ingress intentionally has no `tls` section.

## Deploy worker changes

Build both images when shared packages or worker behavior changes:

```bash
export WORKER_IMAGE="${REGISTRY}/${REGISTRY_NAMESPACE}/enschedule-worker"

docker build --target dashboard --tag "${DASHBOARD_IMAGE}:${IMAGE_TAG}" .
docker build --target worker --tag "${WORKER_IMAGE}:${IMAGE_TAG}" .
docker push "${DASHBOARD_IMAGE}:${IMAGE_TAG}"
docker push "${WORKER_IMAGE}:${IMAGE_TAG}"
```

Dry-run and apply a Helm upgrade that updates the worker, migration job, and dashboard together:

```bash
helm upgrade "$RELEASE" "$CHART" \
  --namespace "$NAMESPACE" \
  --reuse-values \
  --set-string dashboard.image.repository="$DASHBOARD_IMAGE" \
  --set-string dashboard.image.tag="$IMAGE_TAG" \
  --set-string worker.image.repository="$WORKER_IMAGE" \
  --set-string worker.image.tag="$IMAGE_TAG" \
  --set-string migrationJob.image.repository="$WORKER_IMAGE" \
  --set-string migrationJob.image.tag="$IMAGE_TAG" \
  --dry-run=server \
  --hide-secret

helm upgrade "$RELEASE" "$CHART" \
  --namespace "$NAMESPACE" \
  --reuse-values \
  --set-string dashboard.image.repository="$DASHBOARD_IMAGE" \
  --set-string dashboard.image.tag="$IMAGE_TAG" \
  --set-string worker.image.repository="$WORKER_IMAGE" \
  --set-string worker.image.tag="$IMAGE_TAG" \
  --set-string migrationJob.image.repository="$WORKER_IMAGE" \
  --set-string migrationJob.image.tag="$IMAGE_TAG" \
  --wait \
  --timeout 10m
```

Back up PostgreSQL before deploying database or migration changes. Verify the migration Job in addition to the Deployment:

```bash
kubectl -n "$NAMESPACE" get jobs,pods
kubectl -n "$NAMESPACE" logs job/migrations --all-containers --tail=200
kubectl -n "$NAMESPACE" rollout status deployment/enschedule --timeout=10m
```

## Roll back

Review Helm history and roll back to the last known-good revision:

```bash
helm -n "$NAMESPACE" history "$RELEASE"
helm -n "$NAMESPACE" rollback "$RELEASE" REVISION --wait --timeout 10m
kubectl -n "$NAMESPACE" rollout status deployment/enschedule --timeout=10m
curl --fail --show-error --silent "${PUBLIC_URL}/healthz"
```

Replace `REVISION` with the desired revision number from `helm history`.
