---
sidebar_position: 1
---

Enschedule is currently in beta.

## Single docker file

You can test it out by running everything in a single container:

```bash
docker container run -it --rm \
  --name enschedule-dashboard \
  -e SQLITE=":memory:" \
  -e LOGS="/var/logs/enschedule" \
  -e IMPORT_FUNCTIONS="@enschedule-fns/fetch,@enschedule-fns/log" \
  -e ADMIN_ACCOUNT=adm1n:s3cr3t \
  -p 3333:3000 \
  ghcr.io/ricsam/enschedule-dashboard:alpha
```

You have to login to the admin account to view [schedules](./schedules), [runs](./runs), [functions](./functions) and [workers](./workers).

Because you added IMPORT_FUNCTIONS you should have a [fetch function](https://www.npmjs.com/package/@enschedule-fns/fetch) and a [log function](https://www.npmjs.com/package/@enschedule-fns/log).

The schedules and runs will be stored in the sqlite database, in memory.


## Helm chart

Getting started with the helm chart:

```bash
helm show values --devel enschedule/enschedule | pbcopy
helm upgrade --devel --install enschedule enschedule/enschedule --version v0.0.1-alpha --namespace enschedule -f tasks/values.yml
```


## Advanced options

Advanced options:
```bash
ACCESS_TOKEN_SECRET=secret       # signs the short lived access JWT token
REFRESH_TOKEN_SECRET=secret      # signs the long lived access JWT token
COOKIE_SESSION_SECRET=secret     # signs the cookies
```
