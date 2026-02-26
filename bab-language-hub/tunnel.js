const fs = require('fs');
const path = require('path');
const localtunnel = require('localtunnel');

const outputFile = path.join(__dirname, 'tunnel-url.txt');
const logFile = path.join(__dirname, 'tunnel-log.txt');

function writeLog(message) {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logFile, line, 'utf8');
}

(async () => {
    try {
        fs.writeFileSync(outputFile, 'STARTING', 'utf8');
        writeLog('Starting localtunnel...');

        const timeout = setTimeout(() => {
            fs.writeFileSync(outputFile, 'ERROR:Timeout while creating tunnel', 'utf8');
            writeLog('Timeout while creating tunnel');
            process.exit(1);
        }, 20000);

        const tunnel = await localtunnel({ port: 8080 });
        clearTimeout(timeout);
        fs.writeFileSync(outputFile, tunnel.url, 'utf8');
        writeLog(`Tunnel URL: ${tunnel.url}`);

        tunnel.on('close', () => {
            fs.writeFileSync(outputFile, 'CLOSED', 'utf8');
            writeLog('Tunnel closed');
            process.exit(0);
        });

        setInterval(() => { }, 1000);
    } catch (error) {
        fs.writeFileSync(outputFile, `ERROR:${error.message}`, 'utf8');
        writeLog(`Error: ${error.stack || error.message}`);
        process.exit(1);
    }
})();