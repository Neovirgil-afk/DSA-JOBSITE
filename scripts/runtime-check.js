'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

function listenOnAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close((error) => error ? reject(error) : resolve(port));
        });
    });
}

async function main() {
    const port = await listenOnAvailablePort();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobpath-runtime-'));
    const child = spawn(process.execPath, ['server.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: {
            ...process.env,
            NODE_ENV: 'test',
            PORT: String(port),
            SESSION_SECRET: 'runtime-check-only-secret',
            JOBPATH_DB_PATH: path.join(tempDir, 'jobpath.db'),
            JOBPATH_UPLOAD_DIR: path.join(tempDir, 'uploads')
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let logs = '';
    child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
    child.stderr.on('data', (chunk) => { logs += chunk.toString(); });

    async function request(route) {
        return fetch('http://127.0.0.1:' + port + route, {
            redirect: 'manual',
            signal: AbortSignal.timeout(2500)
        });
    }

    try {
        let healthy = false;
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
            if (child.exitCode !== null) throw new Error('Server exited before becoming healthy.\n' + logs);
            try {
                const response = await request('/api/health');
                if (response.status === 200) {
                    const body = await response.json();
                    if (body.status !== 'ok') throw new Error('Health endpoint returned an unexpected body.');
                    healthy = true;
                    break;
                }
            } catch (error) {
                if (error.message.includes('unexpected body')) throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
        if (!healthy) throw new Error('Server did not become healthy within 20 seconds.\n' + logs);

        for (const route of ['/', '/profile.html', '/resume-builder.html', '/career-center.html', '/applications.html', '/employer.html']) {
            const response = await request(route);
            if (response.status !== 200) throw new Error('Expected public page ' + route + ' to return 200; received ' + response.status + '.');
            const type = response.headers.get('content-type') || '';
            if (!type.includes('text/html')) throw new Error('Expected ' + route + ' to return HTML, got ' + type + '.');
        }

        for (const route of ['/server.js', '/package.json', '/database.js', '/uploads/private-resume.pdf']) {
            const response = await request(route);
            if (response.status !== 404) throw new Error('Expected private path ' + route + ' to return 404; received ' + response.status + '.');
        }

        const privateApi = await request('/api/resume/current');
        if (![401, 403].includes(privateApi.status)) throw new Error('Unauthenticated resume API should be denied; received ' + privateApi.status + '.');

        console.log('Runtime integration check passed: server health, 6 public pages, 4 private paths, and unauthenticated API protection.');
    } finally {
        if (child.exitCode === null) {
            child.kill('SIGTERM');
            await Promise.race([
                new Promise((resolve) => child.once('exit', resolve)),
                new Promise((resolve) => setTimeout(resolve, 3000))
            ]);
            if (child.exitCode === null) child.kill('SIGKILL');
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error('JobPath runtime integration check FAILED');
    console.error(error.stack || error);
    process.exitCode = 1;
});
