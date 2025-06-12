import { sendRequestToMCP } from './mcp.js';
import callLLMWithHistory from './llm_functions.js'
import ExcelJS from 'exceljs';

let totalChatHistory = []

export async function runLLMLoop(userInput) {
  const history = [];
  totalChatHistory.push({ role: "user", content: userInput });
  let toolResult = null;

  for (let i = 0; i < 5; i++) {
    const llmAction = await callLLMWithHistory(history, totalChatHistory, toolResult);

    if (llmAction.type === "tool") {
      console.log("Using " + llmAction.toolCall.tool)
      if (llmAction.toolCall.tool === "create_spreadsheet") {
        return useSpreadsheetTool(llmAction.toolCall.arguments);
      }

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

async function useSpreadsheetTool(args) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    sheet.addRow(args.columns);
    for (const row of args.rows) {
      sheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      status: "success",
      filename: args.filename || "report.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: buffer.toString('base64')
    };
}