import { validateTool } from './helpers.js';
import { askLLMForToolCall, askLLMToGenerateAnswer } from './llm_functions.js';
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

runToolFromUserInput("What tables do you have?");