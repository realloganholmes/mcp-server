const validTools = [
    "list_tables",
    "describe_table",
    "read_query"
];

export function validateTool(toolCall) {
    return validTools.includes(toolCall.tool);
}