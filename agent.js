import { validateTool } from './helpers.js';
import { askLLMForToolCall, askLLMToGenerateAnswer, callLLMWithHistory } from './llm_functions.js';
import { sendRequestToMCP } from './mcp.js';

export async function runToolFromUserInput(userInput) {
  try {
    const toolCall = await askLLMForToolCall(userInput);

    if (!toolCall.use_tool) {
      return toolCall.answer;
    }

    if (!validateTool) {
      throw new Error(`Unknown tool requested: ${toolCall.tool}`);
    }

    const mcpResponse = await sendRequestToMCP(toolCall);
    const finalAnswer = await askLLMToGenerateAnswer(userInput, toolCall, mcpResponse);

    return finalAnswer;
  } catch (err) {
    console.error("Error running tool:", err);
    throw err;
  }
}

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