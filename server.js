import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import { getMyOpenAILLM } from "./myAPILLM.js";
import { listTablesTool, describeTableTool, readQueryTool } from "./mcpTools.js";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { PromptTemplate } from "@langchain/core/prompts";

import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static('public'));

const llm = getMyOpenAILLM({
  apiKey: process.env.API_KEY,
  apiBase: "https://ai-model-proxy.aks-ur-prd-internal.8451.cloud/v1",
  modelName: "gpt-4o-mini"
});

const tools = [listTablesTool, describeTableTool, readQueryTool];

let agentExecutor;
(async () => {
  try {
    agentExecutor = await initializeAgentExecutorWithOptions(tools, llm, {
      agentType: "chat-zero-shot-react-description",
      verbose: true,
      maxIterations: 5,
      returnIntermediateSteps: true,
      agentArgs: {
        prefix: `You are a helpful SQL database assistant. You have access to tools that can help you query and understand a database.

ALWAYS use the available tools to get information. Do not make assumptions about what tables or data exist.

Available tools:
- list_tables: Lists all tables in the database
- describe_table: Shows the structure of a specific table  
- read_query: Executes a SQL query

Use this format:
Thought: I need to understand what the user is asking and determine what information I need.
Action: [tool_name]
Action Input: [input for the tool]
Observation: [result from the tool]
... (repeat Thought/Action/Action Input/Observation as needed)
Thought: I now have enough information to answer the user's question.
Final Answer: [your final response to the user]

Begin!`,
        suffix: `Question: {input}
{agent_scratchpad}`
      }
    });
    console.log("Agent initialized successfully");
  } catch (error) {
    console.error("Error initializing agent:", error);
  }
})();

app.post("/chat", async (req, res) => {
  if (!agentExecutor) {
    return res.status(500).json({ error: "Agent not initialized yet" });
  }

  const input = req.body.message;
  console.log("User input:", input);
  
  try {
    const result = await agentExecutor.invoke({ 
      input,
    });
    
    console.log("Agent result:", result);
    
    res.json({ 
      response: result.output,
      steps: result.intermediateSteps?.length || 0
    });
  } catch (e) {
    console.error("Agent execution error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("Server ready"));

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