* rename definitions to handlers
* runs the jobDef can be string. That one is parsed in the front-end now. This one does not include the handler version, see `this.definedJobs[schedule.target]?.[schedule.handlerVersion] ?? schedule.target`.
* replace getPublicHandlers with getLatestHandlers where applicable
* replace getPublicHandler getLatestHandler
* add UI to select specific worker to run on
* test when there are 2 versions of a handler up and running
* test the @enschedule/hub

