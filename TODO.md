* rename definitions to handlers
* runs the jobDef can be string. That one is parsed in the front-end now. This one does not include the handler version, see `this.definedJobs[schedule.target]?.[schedule.handlerVersion] ?? schedule.target`.
* add UI to select specific worker to run on
* test when there are 2 versions of a handler up and running
* test the @enschedule/hub
* add zod on the params of registerJob in case user uses javascript and not typescript

