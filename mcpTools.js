import { DynamicTool } from "@langchain/core/tools";
import { sendRequestToMCP } from "./mcp.js";

// Helper function to extract meaningful content from MCP response
function extractMCPResult(response) {
  console.log("Raw MCP response:", JSON.stringify(response, null, 2));
  
  try {
    // Handle successful MCP response
    if (response && response.result) {
      // If result has content array (typical MCP format)
      if (response.result.content && Array.isArray(response.result.content)) {
        const textContent = response.result.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n');
        console.log("Extracted text content:", textContent);
        return textContent;
      }
      
      // If result has direct content
      if (response.result.content && response.result.content.text) {
        return response.result.content.text;
      }
      
      // If result is direct data
      if (typeof response.result === 'string') {
        return response.result;
      }
      
      // Return result as JSON string if it's structured data
      return JSON.stringify(response.result, null, 2);
    }
    
    // Handle error response
    if (response && response.error) {
      const errorMsg = `MCP Error: ${response.error.message || JSON.stringify(response.error)}`;
      console.log("MCP Error:", errorMsg);
      return errorMsg;
    }
    
    // Fallback
    console.log("Unexpected response format, returning as JSON");
    return JSON.stringify(response, null, 2);
  } catch (error) {
    console.error("Error extracting MCP result:", error);
    return `Error processing MCP response: ${error.message}`;
  }
}

export const listTablesTool = new DynamicTool({
  name: "list_tables",
  description: "Lists all tables in the database. Use this to see what tables are available.",
  func: async (input) => {
    console.log("list_tables called with:", input);
    try {
      const response = await sendRequestToMCP({ tool: "list_tables", arguments: {} });
      const result = extractMCPResult(response);
      console.log("list_tables returning:", result);
      return result;
    } catch (error) {
      console.error("list_tables error:", error);
      return `Error listing tables: ${error.message}`;
    }
  },
});

export const describeTableTool = new DynamicTool({
  name: "describe_table",
  description: "Describes the structure of a table. Input should be the table name as a string.",
  func: async (input) => {
    console.log("describe_table called with:", input);
    try {
      // Handle both string and object inputs
      const tableName = typeof input === 'string' ? input.trim() : input?.table_name;
      if (!tableName) {
        return "Error: Please provide a table name";
      }
      
      const response = await sendRequestToMCP({ 
        tool: "describe_table", 
        arguments: { table_name: tableName } 
      });
      const result = extractMCPResult(response);
      console.log("describe_table returning:", result);
      return result;
    } catch (error) {
      console.error("describe_table error:", error);
      return `Error describing table: ${error.message}`;
    }
  },
});

export const readQueryTool = new DynamicTool({
  name: "read_query", 
  description: "Executes a read-only SQL query. Input should be the SQL query as a string.",
  func: async (input) => {
    console.log("read_query called with:", input);
    try {
      // Handle both string and object inputs
      const sql = typeof input === 'string' ? input.trim() : input?.sql;
      if (!sql) {
        return "Error: Please provide a SQL query";
      }
      
      const response = await sendRequestToMCP({ 
        tool: "read_query", 
        arguments: { sql: sql } 
      });
      const result = extractMCPResult(response);
      console.log("read_query returning:", result);
      return result;
    } catch (error) {
      console.error("read_query error:", error);
      return `Error executing query: ${error.message}`;
    }
  },
});