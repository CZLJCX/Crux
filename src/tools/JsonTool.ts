import { ToolExecuteFunc } from '../core/types.js';

function jsonPath(obj: any, path: string): any {
  const tokens = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let result = obj;
  for (const token of tokens) {
    if (result === null || result === undefined) return undefined;
    result = result[token];
  }
  return result;
}

export const JsonTool: ToolExecuteFunc = async (args: Record<string, unknown>) => {
  const { action, json, path, indent, query } = args;
  const actionName = action as string || 'parse';

  try {
    switch (actionName) {
      case 'parse': {
        if (!json) {
          return JSON.stringify({ error: 'json is required' });
        }

        let parsed: any;
        if (typeof json === 'string') {
          parsed = JSON.parse(json);
        } else {
          parsed = json;
        }

        return JSON.stringify({
          success: true,
          type: Array.isArray(parsed) ? 'array' : typeof parsed,
          size: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length,
          preview: JSON.stringify(parsed).substring(0, 500),
        });
      }

      case 'stringify': {
        if (!json) {
          return JSON.stringify({ error: 'json is required' });
        }

        let obj: any;
        if (typeof json === 'string') {
          obj = JSON.parse(json);
        } else {
          obj = json;
        }

        const spaces = typeof indent === 'number' ? indent : 2;
        const result = JSON.stringify(obj, null, spaces);

        return JSON.stringify({
          success: true,
          result,
          length: result.length,
        });
      }

      case 'query': {
        if (!json || !path) {
          return JSON.stringify({ error: 'json and path are required' });
        }

        let obj: any;
        if (typeof json === 'string') {
          obj = JSON.parse(json);
        } else {
          obj = json;
        }

        const result = jsonPath(obj, path as string);
        const found = result !== undefined;

        return JSON.stringify({
          success: true,
          path: path as string,
          found,
          result,
          type: typeof result,
        });
      }

      case 'validate': {
        if (!json) {
          return JSON.stringify({ error: 'json is required' });
        }

        if (typeof json !== 'string') {
          return JSON.stringify({
            success: true,
            valid: true,
            message: 'Input is already a JavaScript object',
          });
        }

        try {
          JSON.parse(json);
          return JSON.stringify({
            success: true,
            valid: true,
            message: 'Valid JSON string',
          });
        } catch (e: any) {
          const match = e.message.match(/position (\d+)/);
          const position = match ? parseInt(match[1]) : null;
          return JSON.stringify({
            success: true,
            valid: false,
            error: e.message,
            position,
            near: position ? json.substring(Math.max(0, position - 10), position + 10) : null,
          });
        }
      }

      case 'format': {
        if (!json) {
          return JSON.stringify({ error: 'json is required' });
        }

        let obj: any;
        if (typeof json === 'string') {
          obj = JSON.parse(json);
        } else {
          obj = json;
        }

        const spaces = typeof indent === 'number' ? indent : 2;
        const formatted = JSON.stringify(obj, null, spaces);

        return JSON.stringify({
          success: true,
          formatted,
          lines: formatted.split('\n').length,
        });
      }

      case 'keys': {
        if (!json) {
          return JSON.stringify({ error: 'json is required' });
        }

        let obj: any;
        if (typeof json === 'string') {
          obj = JSON.parse(json);
        } else {
          obj = json;
        }

        const keys = Object.keys(obj);
        const types: Record<string, string> = {};
        for (const key of keys) {
          types[key] = Array.isArray(obj[key]) ? 'array' : typeof obj[key];
        }

        return JSON.stringify({
          success: true,
          keys,
          count: keys.length,
          types,
        });
      }

      case 'diff': {
        const { json1, json2 } = args;
        if (!json1 || !json2) {
          return JSON.stringify({ error: 'json1 and json2 are required' });
        }

        let obj1: any, obj2: any;
        if (typeof json1 === 'string') {
          obj1 = JSON.parse(json1);
        } else {
          obj1 = json1;
        }
        if (typeof json2 === 'string') {
          obj2 = JSON.parse(json2);
        } else {
          obj2 = json2;
        }

        const changes: { path: string; type: string; oldValue?: any; newValue?: any }[] = [];
        
        function compare(o1: any, o2: any, path: string = '') {
          if (o1 === o2) return;
          
          if (typeof o1 !== typeof o2) {
            changes.push({ path, type: 'type_change', oldValue: o1, newValue: o2 });
            return;
          }
          
          if (typeof o1 !== 'object' || o1 === null || o2 === null) {
            if (o1 !== o2) {
              changes.push({ path, type: 'modified', oldValue: o1, newValue: o2 });
            }
            return;
          }
          
          const keys1 = Object.keys(o1);
          const keys2 = Object.keys(o2);
          
          for (const key of keys1) {
            if (!(key in o2)) {
              changes.push({ path: path ? `${path}.${key}` : key, type: 'removed', oldValue: o1[key] });
            } else {
              compare(o1[key], o2[key], path ? `${path}.${key}` : key);
            }
          }
          
          for (const key of keys2) {
            if (!(key in o1)) {
              changes.push({ path: path ? `${path}.${key}` : key, type: 'added', newValue: o2[key] });
            }
          }
        }
        
        compare(obj1, obj2);

        return JSON.stringify({
          success: true,
          identical: changes.length === 0,
          changes,
          changeCount: changes.length,
        });
      }

      case 'merge': {
        const { json1, json2, deep } = args;
        if (!json1 || !json2) {
          return JSON.stringify({ error: 'json1 and json2 are required' });
        }

        let obj1: any, obj2: any;
        if (typeof json1 === 'string') {
          obj1 = JSON.parse(json1);
        } else {
          obj1 = json1;
        }
        if (typeof json2 === 'string') {
          obj2 = JSON.parse(json2);
        } else {
          obj2 = json2;
        }

        function deepMerge(target: any, source: any): any {
          const result = { ...target };
          for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key]) {
              result[key] = deepMerge(target[key], source[key]);
            } else {
              result[key] = source[key];
            }
          }
          return result;
        }

        const merged = deep ? deepMerge(obj1, obj2) : { ...obj1, ...obj2 };

        return JSON.stringify({
          success: true,
          result: merged,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${actionName}` });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message, success: false });
  }
};

export const JsonToolDefinition = {
  name: 'json',
  description: 'Parse, validate, query, format, and manipulate JSON data with JSONPath support',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['parse', 'stringify', 'query', 'validate', 'format', 'keys', 'diff', 'merge'],
        description: 'JSON operation to perform',
      },
      json: {
        description: 'JSON string or object to process',
      },
      path: {
        type: 'string',
        description: 'JSONPath expression for query (e.g., $.data.items[0].name)',
      },
      indent: {
        type: 'number',
        description: 'Indentation spaces for formatting (default: 2)',
      },
      json1: {
        description: 'First JSON for diff or merge',
      },
      json2: {
        description: 'Second JSON for diff or merge',
      },
      deep: {
        type: 'boolean',
        description: 'Perform deep merge (default: false)',
      },
    },
    required: ['action'],
  },
};