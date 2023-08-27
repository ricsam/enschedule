import { chromium, type FullConfig } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function globalTeardown(config: FullConfig) {
    // console.log('Running global teardown')
    // fs.writeFileSync(path.join(os.homedir(), 'wef'), 'test');
}

export default globalTeardown;
