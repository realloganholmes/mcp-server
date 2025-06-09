import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { runToolFromUserInput } from './agent.js';
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
    const response = await runToolFromUserInput(userInput);
    res.json({ response });
  } catch (err) {
    console.error("Failed to handle chat input:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
