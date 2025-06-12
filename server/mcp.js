import { spawn } from 'child_process';
import { sendProgressToClients } from './server.js';
import dotenv from 'dotenv';
dotenv.config();

const mcpProcess = spawn('C:\\Users\\LH24481\\AppData\\Roaming\\nvm\\v22.12.0\\node.exe', [
    'node_modules\\@executeautomation\\database-server\\dist\\src\\index.js',
    '--sqlserver',
    '--server', 'sql-sc-scwc-dev-eastus2.database.windows.net',
    '--database', 'sqldb-scwc-dev',
    '--user', process.env.DB_USER,
    '--password', process.env.DB_PASSWORD
], {
    stdio: ['pipe', 'pipe', 'inherit']
});

let requestId = 1;

export function sendRequestToMCP(toolCall) {
    const message = `Using tool: ${toolCall.tool} with arguments: ${JSON.stringify(toolCall.arguments)}`;
    sendProgressToClients({ message });

    const request = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
            name: toolCall.tool,
            arguments: toolCall.arguments || {}
        },
        id: requestId++,
    };

    // Listens for response and parses it out.
    return new Promise((resolve, reject) => {
        const jsonRequest = JSON.stringify(request) + '\n';
        mcpProcess.stdin.write(jsonRequest);

        function onData(data) {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
            try {
            const response = JSON.parse(line);
            if (response.id === request.id) {
                mcpProcess.stdout.off('data', onData);
                resolve(response);
            }
            } catch (e) {
            }
        }
        }
        mcpProcess.stdout.on('data', onData);
    });
}