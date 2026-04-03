interface AgentToolRow {
  id: number;
  agent_id: number;
  tool_type: string;
  config: string | null;
  enabled: number;
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  web_search: 'Search the web or fetch content from a URL. Provide a search query or URL as input.',
  code_exec: 'Execute JavaScript code in a sandboxed environment and return the result. Provide the code as input.',
  api_call: 'Make an HTTP API call. Provide JSON with url, method (optional), headers (optional), and body (optional).',
  file_io: 'Read files from the filesystem (read-only). Provide the file path as input.',
};

const TOOL_INPUT_SCHEMAS: Record<string, Record<string, unknown>> = {
  web_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'A search query or URL to fetch' },
    },
    required: ['query'],
  },
  code_exec: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'JavaScript code to execute' },
    },
    required: ['code'],
  },
  api_call: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to call' },
      method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)', default: 'GET' },
      headers: { type: 'object', description: 'Optional HTTP headers' },
      body: { type: 'string', description: 'Optional request body' },
    },
    required: ['url'],
  },
  file_io: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read' },
    },
    required: ['path'],
  },
};

export function toAnthropicTools(tools: AgentToolRow[]) {
  return tools.map((tool) => ({
    name: tool.tool_type,
    description: TOOL_DESCRIPTIONS[tool.tool_type] || tool.tool_type,
    input_schema: {
      type: 'object' as const,
      ...(TOOL_INPUT_SCHEMAS[tool.tool_type] || { properties: {} }),
    },
  }));
}

export function toOpenAITools(tools: AgentToolRow[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.tool_type,
      description: TOOL_DESCRIPTIONS[tool.tool_type] || tool.tool_type,
      parameters: TOOL_INPUT_SCHEMAS[tool.tool_type] || { type: 'object', properties: {} },
    },
  }));
}

export function getToolConfig(tool: AgentToolRow): Record<string, unknown> {
  if (!tool.config) return {};
  try {
    return JSON.parse(tool.config);
  } catch {
    return {};
  }
}
