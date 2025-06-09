import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { runLLMLoop } from './agent.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

app.use(express.static('public'));

app.post('/chat', async (req, res) => {
  const userInput = req.body.message;

  try {
    const response = await runLLMLoop(userInput);
    res.json({ response });
  } catch (err) {
    console.error("Failed to handle chat input:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

const clients = [];

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();

  clients.push(res);

  req.on('close', () => {
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
  });
});

export function sendProgressToClients(message) {
  const eventString = `data: ${JSON.stringify(message)}\n\n`;
  clients.forEach(client => client.write(eventString));
}