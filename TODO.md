* add global poll interval information
* write docs about eventId on schedules (and maybe rename eventId to scheduleName)
* write docs about handlerVersion and migrations
* highlight when schedule doesn't have an associated handler registered
* rename definitions to handlers
* runs the jobDef can be string. That one is parsed in the front-end now. This one does not include the handler version, see `this.definedJobs[schedule.target]?.[schedule.handlerVersion] ?? schedule.target`.
* add UI to select specific worker to run on
* test when there are 2 versions of a handler up and running
* test the @enschedule/hub
* add zod on the params of registerJob in case user uses javascript and not typescript
* Add timeout on jobs (or claimed jobs must be able to be unclaimed)
* Add docs + comments to the docker entry file describing it
* mark as schedule as "claimedBy workerx" and pending after clicking the run now button for example
* fix horizontal scroll on data on runs 
