import { type FullConfig } from "@playwright/test";

async function globalTeardown(config: FullConfig) {
  const pids = (process.env.PIDS || "").split(",");
  const terminationPromises = pids.map((pid) => {
    return new Promise<void>((resolve, reject) => {
      try {
        process.kill(Number(pid), "SIGTERM"); // SIGTERM is a more appropriate signal for a graceful shutdown
        console.log(`Sent termination signal to process ${pid}`);
        let counter = 0;
        const checkProcess = () => {
          try {
            process.kill(Number(pid), 0); // Polling the process
            counter++;
            if (counter > 5) { // Stop polling after 5 attempts
              reject(new Error(`Unable to terminate process ${pid}`));
            } else {
              setTimeout(checkProcess, 1000); // Poll every second
            }
          } catch (err) {
            if (err instanceof Error && 'code' in err && err.code === 'ESRCH') { // Process does not exist
              console.log(`Successfully terminated process ${pid}`);
              resolve();
            } else {
              reject(new Error(`Error while polling process ${pid}: ${err}`));
            }
          }
        };
        checkProcess();
      } catch (err) {
        reject(new Error(`Error sending termination signal to process ${pid}: ${err}`));
      }
    });
  });
  await Promise.all(terminationPromises);
  console.log('Terminated all started processes');
  // playwright swallows the last line
  console.log('\n');
}

export default globalTeardown;
