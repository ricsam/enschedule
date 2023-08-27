import https from 'node:https';
import http from 'node:http';

class WorkerAPI {
    private baseURL: string;
    private apiKey: string;
    private ssl: boolean;
    private port: number;

    constructor(baseURL: string, apiKey: string, ssl: boolean, port: number) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
        this.ssl = ssl;
        this.port = port;
    }

    private async request(method: string, path: string, data?: any) {
        const options = {
            hostname: this.baseURL,
            port: this.port,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': this.apiKey
            }
        };

        return new Promise((resolve, reject) => {
            const req = (this.ssl ? https : http).request(options, res => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve(JSON.parse(body)));
            });

            req.on('error', reject);
            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    async getJobDefinitions() {
        return this.request('GET', '/job-definitions');
    }

    async getJobDefinition(id: string) {
        return this.request('GET', `/job-definitions/${id}`);
    }

    async getSchedules(definitionId: string) {
        return this.request('GET', '/schedules', { definitionId });
    }

    async scheduleJob(jobId: string, data: any, options: any) {
        return this.request('POST', '/schedules', { jobId, data, options });
    }

    async getSchedule(id: number) {
        return this.request('GET', `/schedules/${id}`);
    }

    async deleteSchedules(scheduleIds: number[]) {
        return this.request('DELETE', '/schedules', { scheduleIds });
    }

    async getRuns(scheduleId?: number) {
        return this.request('GET', '/runs', { scheduleId });
    }

    async getRun(id: number) {
        return this.request('GET', `/runs/${id}`);
    }

    async runSchedule(id: number) {
        return this.request('POST', `/schedules/${id}/runs`);
    }
}

export default WorkerAPI;


