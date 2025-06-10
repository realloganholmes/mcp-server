import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import fetch from "node-fetch";

export class MyGatewayChatModel extends BaseChatModel {
  constructor({ apiKey, apiUrl, modelName, supportsToolCalling = false }) {
    super({});
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.modelName = modelName;
    this.supportsToolCalling = supportsToolCalling;
  }

  _llmType() {
    return "my-custom-gateway";
  }

  // Override this to indicate tool calling support
  get callKeys() {
    return ["stop", "signal", "options", "tools", "tool_choice"];
  }

  // Add method to check if model supports function calling
  bindTools(tools, kwargs = {}) {
    if (!this.supportsToolCalling) {
      console.warn("This model may not support native tool calling. Consider using a different approach.");
    }
    return super.bindTools(tools, kwargs);
  }

  async _generate(messages, options, runManager) {
    function mapRole(role) {
        switch(role) {
            case "human": return "user";
            case "ai": return "assistant";
            case "system": return "system";
            default: return role;
        }
    }

    // Prepare the request payload
    const requestBody = {
      model: this.modelName,
      messages: messages.map((msg) => ({
        role: mapRole(msg._getType()),
        content: msg.content || msg.text, // Handle both content and text properties
      })),
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 2000,
      stop: options?.stop,
    };

    // Add tool/function calling support if tools are provided
    if (options?.tools && options.tools.length > 0) {
      // Convert LangChain tools to OpenAI function format
      requestBody.tools = options.tools.map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters || {
            type: "object",
            properties: {},
            required: []
          }
        }
      }));

      if (options.tool_choice) {
        requestBody.tool_choice = options.tool_choice;
      }
    }

    console.log("Sending request to gateway:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gateway API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log("Gateway response:", JSON.stringify(data, null, 2));
    
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error("No choices returned from API");
    }

    const text = choice.message?.content || "";
    const toolCalls = choice.message?.tool_calls || [];

    // Create AI message with potential tool calls
    let message;
    if (toolCalls.length > 0) {
      message = new AIMessage({
        content: text,
        tool_calls: toolCalls.map(tc => ({
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments || "{}"),
          id: tc.id
        }))
      });
    } else {
      message = new AIMessage(text);
    }

    // Create a proper generation object with required properties
    const generation = {
      text,
      message,
      generationInfo: {
        finish_reason: choice.finish_reason || "stop",
        tool_calls: toolCalls
      }
    };

    return {
      generations: [generation],
      llmOutput: {
        tokenUsage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        }
      }
    };
  }

  async _streamResponseChunks() {
    throw new Error("Streaming not implemented");
  }
}

export function getMyOpenAILLM({ apiKey, apiBase, modelName, supportsToolCalling = false }) {
  return new MyGatewayChatModel({
    apiKey,
    apiUrl: apiBase,
    modelName,
    supportsToolCalling,
  });
}