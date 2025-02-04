* Mark runs as "lost" if their corresponding worker is down and the run never finished
* schedule status should technically not be determined by the "lastRun" but rather "by any of its runs"
* add global poll interval information
* write docs about eventId on schedules (and maybe rename eventId to scheduleName)
* write docs about functionVersion and migrations
* highlight when schedule doesn't have an associated handler registered
* rename definitions to handlers
* runs the jobDef can be string. That one is parsed in the front-end now. This one does not include the handler version, see `this.definedJobs[schedule.target]?.[schedule.functionVersion] ?? schedule.target`.
* add UI to select specific worker to run on
* test when there are 2 versions of a handler up and running
* test the @enschedule/hub
* add zod on the params of registerJob in case user uses javascript and not typescript
* Add timeout on jobs (or claimed jobs must be able to be unclaimed)
* Add docs + comments to the docker entry file describing it
* mark as schedule as "claimedBy workerx" and pending after clicking the run now button for example
* fix horizontal scroll on data on runs 
* // connect repo to deploy functions
* Run page: `Ran Transition Pending Drafts which completed ran 11 hours ago and took 20793 ms to run`
