import { ToolExecuteFunc } from '../core/types.js';

export const WebFetchTool: ToolExecuteFunc = async (args) => {
  const { url, format = 'text', timeout = 30000 } = args;

  if (!url) {
    return JSON.stringify({ error: 'url is required' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout as number);

    const response = await fetch(url as string, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Crux/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return JSON.stringify({
        error: `HTTP ${response.status}: ${response.statusText}`,
        success: false,
      });
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json') || format === 'json') {
      const json = await response.json();
      return JSON.stringify({
        content: JSON.stringify(json, null, 2).substring(0, 50000),
        format: 'json',
        status: response.status,
        success: true,
      });
    }

    const text = await response.text();
    const maxLength = 80000;
    const truncated = text.length > maxLength;

    return JSON.stringify({
      content: text.substring(0, maxLength),
      truncated,
      format: 'text',
      status: response.status,
      url: url,
      success: true,
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return JSON.stringify({ error: 'Request timeout', success: false });
    }
    return JSON.stringify({ error: error.message, success: false });
  }
};

export const WebFetchToolDefinition = {
  name: 'web_fetch',
  description: 'Fetch content from a URL',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch',
      },
      format: {
        type: 'string',
        enum: ['text', 'json'],
        description: 'Response format',
        default: 'text',
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        default: 30000,
      },
    },
    required: ['url'],
  },
};