import fetch from 'node-fetch';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

// Ignores self signed cert errors.
const agent = new https.Agent({
  rejectUnauthorized: false,
});

async function callLLM(prompt) {
  const response = await fetch('https://ai-model-proxy.aks-ur-prd-internal.8451.cloud/v1/chat/completions', {
    method: 'POST',
    agent: agent,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.API_KEY
     },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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

export async function askLLMToGenerateAnswer(userInput, toolCall, mcpResponse) {
  const prompt = `
    You are a helpful assistant. A user asked this question:
    "${userInput}"

    The system ran this tool: "${toolCall.tool}" with arguments: ${JSON.stringify(toolCall.arguments || {})}

    The tool returned the following data:
    ${JSON.stringify(mcpResponse.result || mcpResponse.error || mcpResponse, null, 2)}

    Please provide a clear, concise, and friendly answer to the user based on this data.
    `;

  const answer = await callLLM(prompt);

  return answer;
}

export async function askLLMForToolCall(userInput) {
  const prompt = `

    You are an AI assistant that can call the following tools with arguments for a SQL Server database:

    - list_tables(): returns list of table names
    - describe_table(table_name): returns details about a table
    - read_query(query): runs a SQL query and returns results

    Make sure to write any queries in SQL Server notation

    User question: ${userInput}

    Respond ONLY with a JSON object indicating if you would like to use a tool, or just respond:
    {"use_tool": true, "tool": "list_tables", "arguments": {}}
    or
    {"use_tool": true, "tool": "describe_table", "arguments": {"table_name": "customers"}}
    or
    {"use_tool": true, "tool": "read_query", "arguments": {"query": "SELECT * FROM customers LIMIT 10"}}
    or
    {"use_tool": false, "answer": "<your response>"}
    `;

  const llmResponse = await callLLM(prompt);

  try {
    const parsed = JSON.parse(llmResponse.trim());
    return parsed;
  } catch (e) {
    throw new Error("Failed to parse LLM tool call JSON: " + e.message);
  }
}

export async function callLLMWithHistory(history, fullChatHistory, toolResult) {
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

  console.log(prompt);

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
