import vm from 'node:vm';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export async function executeWebSearch(_config: Record<string, unknown>, input: string): Promise<ToolResult> {
  try {
    // Treat input as a URL to fetch, or construct a search query
    let url = input.trim();
    if (!url.startsWith('http')) {
      url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(input)}&format=json`;
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'HiveMind-Agent/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    const text = await response.text();
    // Strip HTML tags and truncate
    const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return { success: true, output: clean.slice(0, 4000) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `Web search failed: ${message}` };
  }
}

export async function executeCodeExec(_config: Record<string, unknown>, code: string): Promise<ToolResult> {
  try {
    const context = vm.createContext({
      console: { log: (...args: unknown[]) => args.map(String).join(' ') },
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      Array,
      Object,
      String: globalThis.String,
      Number: globalThis.Number,
      Boolean: globalThis.Boolean,
      RegExp,
      Map,
      Set,
    });

    const result = vm.runInContext(code, context, { timeout: 5000 });
    const output = result !== undefined ? String(result) : 'undefined';
    return { success: true, output: output.slice(0, 4000) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `Code execution failed: ${message}` };
  }
}

export async function executeApiCall(config: Record<string, unknown>, input: string): Promise<ToolResult> {
  try {
    let params: { url: string; method?: string; headers?: Record<string, string>; body?: string };
    try {
      params = JSON.parse(input);
    } catch {
      // If input isn't JSON, treat it as a URL
      params = { url: input.trim() };
    }

    const baseUrl = (config.base_url as string) || '';
    const url = baseUrl + params.url;
    const method = params.method || 'GET';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.default_headers as Record<string, string> || {}),
      ...(params.headers || {}),
    };

    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' ? params.body : undefined,
      signal: AbortSignal.timeout(15000),
    });

    const text = await response.text();
    return { success: true, output: text.slice(0, 4000) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `API call failed: ${message}` };
  }
}

export async function executeFileIo(config: Record<string, unknown>, input: string): Promise<ToolResult> {
  // File I/O is restricted for security - only return a message
  const _allowedPaths = (config.allowed_paths as string[]) || [];
  return {
    success: false,
    output: '',
    error: `File I/O is disabled for security. Requested: ${input.slice(0, 100)}`,
  };
}

export async function executeTool(
  toolType: string,
  config: Record<string, unknown>,
  input: string,
): Promise<ToolResult> {
  switch (toolType) {
    case 'web_search':
      return executeWebSearch(config, input);
    case 'code_exec':
      return executeCodeExec(config, input);
    case 'api_call':
      return executeApiCall(config, input);
    case 'file_io':
      return executeFileIo(config, input);
    default:
      return { success: false, output: '', error: `Unknown tool type: ${toolType}` };
  }
}
