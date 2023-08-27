# Turborepo starter

This is an official starter Turborepo.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `ui`: a stub React component library shared by both `web` and `docs` applications
- `eslint-config-custom`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `tsconfig`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd my-turborepo
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo
pnpm dev
```

### Remote Caching

Turborepo can use a technique known as [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup), then enter the following commands:

```
cd my-turborepo
npx turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
npx turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
- [Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
- [Configuration Options](https://turbo.build/repo/docs/reference/configuration)
- [CLI Usage](https://turbo.build/repo/docs/reference/command-line-reference)



Certainly! The hierarchy of `Definition`, `Schedule`, and `Run` in your application sets up a clear logical flow. Here's an in-depth look:

### 1. **Definition**:

- **Purpose**: This is the foundational layer. It defines the task that needs to be performed but doesn't dictate when it should run or how often.
  
- **Attributes**:
  - `id`: A unique identifier for the definition.
  - `title`: A human-readable name for the job. This could be used in the UI to easily identify a job.
  - `description`: Provides more details about what the job does.
  - `dataSchema`: The expected structure and type of the data that the job requires. It ensures that the job receives data in the right format.
  - `job`: The actual logic or function that will be executed when this job is run. It might perform tasks like sending an HTTP request, logging data, or any other server-side operation.
  - `example`: An example of the data that the job expects, useful for documentation or testing purposes.

### 2. **Schedule**:

- **Purpose**: The schedule layer determines when and how often a specific definition should run. It's a bridge between the static job definition and its dynamic execution.

- **Attributes**:
  - `id`: Unique identifier for the schedule.
  - `description`: More details about the schedule.
  - `title`: Human-readable name for the schedule.
  - `runAt`: Specific date and time when the job should run.
  - `cronExpression`: If the job is recurring, this defines the pattern (e.g., every day at midnight).
  - `lastRun`: Information about the last time the job was run.
  - `createdAt`: The date and time when the schedule was created.
  - `target`: The specific job definition this schedule refers to.
  - `jobDefinition`: Embedded information about the related job definition.
  - `numRuns`: How many times the job associated with this schedule has run.
  - `data`: The specific data that should be passed to the job when it's run.

### 3. **Run**:

- **Purpose**: Represents each individual execution of a scheduled job. It provides a record of every time a job has been run, whether successfully or with errors.

- **Attributes**:
  - `id`: Unique identifier for the run.
  - `stdout`: Standard output from the job. This could include any logs or messages the job has generated during its execution.
  - `stderr`: Standard error from the job. This captures any errors or exceptions the job encountered.
  - `createdAt`: The date and time when the run started.
  - `finishedAt`: The date and time when the run finished.
  - `scheduledToRunAt`: The date and time when the job was originally scheduled to run. Useful for checking if the job ran on time.
  - `data`: The specific data that was passed to the job during this run.
  - `jobSchedule`: Embedded information about the related schedule, which in turn connects to the job definition.

### Flow:

- A **Definition** is created to specify a job that can be run.
- A **Schedule** is then created to determine when and how often that job should be executed.
- Every time the job is run according to its schedule, a **Run** is created to log the details of that execution.

This hierarchy creates a clear progression from defining tasks, scheduling them, and recording each execution. It's a modular approach that allows flexibility in scheduling different instances of tasks and provides a comprehensive record of task executions.