#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

minikube start

./build-images.sh

helm uninstall enschedule

while [[ $(kubectl get pods | wc -l) -gt 0 ]]; do
  sleep 5
done

minikube image rm 'ghcr.io/ricsam/enschedule-worker:latest'
minikube image rm 'ghcr.io/ricsam/enschedule-dashboard:latest'

minikube image load --overwrite=true 'ghcr.io/ricsam/enschedule-worker:latest'
minikube image load --overwrite=true 'ghcr.io/ricsam/enschedule-dashboard:latest'

helm upgrade --install enschedule ./charts/enschedule \
  --set worker.image.pullPolicy=Never \
  --set dashboard.image.pullPolicy=Never \
  --set dashboard.service.type=ClusterIP \
  --set dashboard.service.port=3000

# minikube service dashboard-service --url

# dashboard
export POD_NAME=$(kubectl get pods --namespace default -l "app.kubernetes.io/name=dashboard" -o jsonpath="{.items[0].metadata.name}")
export CONTAINER_PORT=$(kubectl get pod --namespace default $POD_NAME -o jsonpath="{.spec.containers[0].ports[0].containerPort}")
echo "Visit http://127.0.0.1:8080 to use your application"
kubectl --namespace default port-forward $POD_NAME 8080:$CONTAINER_PORT

# Worker
export POD_NAME=$(kubectl get pods --namespace default -l "app.kubernetes.io/name=enschedule" -o jsonpath="{.items[2].metadata.name}")
export CONTAINER_PORT=$(kubectl get pod --namespace default $POD_NAME -o jsonpath="{.spec.containers[0].ports[0].containerPort}")
echo "Visit http://127.0.0.1:8888 to use your application"
kubectl --namespace default port-forward $POD_NAME 8888:$CONTAINER_PORT

SESSION_SECRET=abc API_KEY=secret_key WORKER_URL=http://localhost:8888 DEBUG=worker-api yarn run docker:start

# docker container run --rm -e PORT=3000 -e PGUSER=postgres -e PGHOST=postgres -e PGPASSWORD=postgres -e PGDATABASE=postgres -e PGPORT=5432 -p 3030:3000 --network enschedule-2_default ghcr.io/ricsam/enschedule-worker:latest
docker container run --rm -e SESSION_SECRET=abc -e API_KEY=secret_key -e WORKER_URL=http://localhost:3030 -e DEBUG=worker-api -p 8080:3000 ghcr.io/ricsam/enschedule-dashboard:latest
