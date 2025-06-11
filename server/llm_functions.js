import fetch from 'node-fetch';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

// Ignores self signed cert errors.
const agent = new https.Agent({
  rejectUnauthorized: false,
});

async function callLLM(prompt) {
  const response = await fetch(process.env.LLM_URL, {
    method: 'POST',
    agent: agent,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.API_KEY
     },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages: [
        {
          content: prompt
        }
      ]
    }),
  });
  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.statusText}`);
  }
  const json = await response.json();
  return json.choices[0].message.content;
}

export default async function callLLMWithHistory(history, fullChatHistory, toolResult) {
  let prompt = `You are an intelligent database assistant. Here are the tools you can use and example arguments:
   {"tool": "list_tables", "arguments": {}},
   {"tool": "describe_table", "arguments": {"table_name": "customers"}},
   {"tool": "read_query", "arguments": {"query": "SELECT * FROM customers LIMIT 10"}}

   As a smart and efficient assistant, you always research table names and schemas before writing queries in order to avoid mistakes. Any SQL you write must be in SQL Server notation, otherwise we will encounter errors.

    Based on the chat history and any tool results, decide what to do next. Only use tools if they are needed to address the users query, otherwise if you have enough information to respond from the history, just respond.
    
    You can ONLY respond with a json message of the following formats:
    - Use a tool: respond with {"type": "tool", "toolCall": {"tool": "list_tables", "arguments": {}}}
    - Or answer the user directly: respond with {"type": "response", "content": "Here's the answer..."}

    Here is the chat history:\n`;

  for (const msg of fullChatHistory) {
    prompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
  }

  prompt += `\nThe previous steps you have taken are as follows:\n`;

  for (const msg of history) {
    prompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
  }

  if (toolResult) {
    prompt += `\nTool Result: ${JSON.stringify(toolResult)}\n`;
  }

  prompt += `\nWhat should we do next?\n`;

  const llmRawResponse = await callLLM(prompt);

  try {
    const action = JSON.parse(llmRawResponse.trim());
    if (
      (action.type === "tool" && action.toolCall && action.toolCall.tool) ||
      (action.type === "response" && typeof action.content === "string")
    ) {
      return action;
    }
    throw new Error("Invalid structure");
  } catch (err) {
    throw new Error("LLM did not return a valid JSON object: " + llmRawResponse);
  }
}
