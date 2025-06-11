import { sendRequestToMCP } from './mcp.js';
import callLLMWithHistory from './llm_functions.js'

let totalChatHistory = []

export async function runLLMLoop(userInput) {
  const history = [];
  totalChatHistory.push({ role: "user", content: userInput });
  let toolResult = null;

  for (let i = 0; i < 5; i++) {
    const llmAction = await callLLMWithHistory(history, totalChatHistory, toolResult);

    if (llmAction.type === "tool") {
      const response = await sendRequestToMCP(llmAction.toolCall);
      toolResult = response;
      history.push({
        role: "assistant",
        content: `Used tool: ${llmAction.toolCall.tool}. Result: ${JSON.stringify(response)}`
      });
    } else if (llmAction.type === "response") {
      totalChatHistory.push({ role: "assistant", content: llmAction.content});
      return llmAction.content;
    }
  }

  return "I'm not able to complete this request after several steps.";
}