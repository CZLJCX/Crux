import { ToolExecuteFunc } from '../core/types.js';

function safeEval(expression: string): number | null {
  const sanitized = expression
    .replace(/[^0-9+\-*/().^%sincostalnqrtsqrtabslogepi]/gi, '')
    .replace(/sin/gi, 'Math.sin')
    .replace(/cos/gi, 'Math.cos')
    .replace(/tan/gi, 'Math.tan')
    .replace(/sqrt/gi, 'Math.sqrt')
    .replace(/abs/gi, 'Math.abs')
    .replace(/log/gi, 'Math.log10')
    .replace(/ln/gi, 'Math.log')
    .replace(/exp/gi, 'Math.exp')
    .replace(/pi/gi, 'Math.PI')
    .replace(/e(?![xp])/gi, 'Math.E')
    .replace(/\^/g, '**');
  
  try {
    const result = Function(`"use strict"; return (${sanitized})`)();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

export const CalculatorTool: ToolExecuteFunc = async (args: Record<string, unknown>) => {
  const { action, expression, precision } = args;
  const actionName = action as string || 'calculate';

  try {
    switch (actionName) {
      case 'calculate': {
        if (!expression || typeof expression !== 'string') {
          return JSON.stringify({ error: 'expression is required' });
        }

        const result = safeEval(expression as string);
        if (result === null) {
          return JSON.stringify({ error: 'Invalid expression', expression });
        }

        const prec = typeof precision === 'number' ? precision : 10;
        const rounded = Math.round(result * Math.pow(10, prec)) / Math.pow(10, prec);

        return JSON.stringify({
          success: true,
          expression,
          result: rounded,
          rawResult: result,
        });
      }

      case 'convert': {
        const { value, from, to } = args;
        if (!value || !from || !to) {
          return JSON.stringify({ error: 'value, from, and to are required' });
        }

        const conversions: Record<string, Record<string, number | string>> = {
          length: {
            mm: 0.001, cm: 0.01, m: 1, km: 1000,
            in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
          },
          weight: {
            mg: 0.000001, g: 0.001, kg: 1, t: 1000,
            oz: 0.0283495, lb: 0.453592,
          },
          temperature: {
            c: 'celsius', f: 'fahrenheit', k: 'kelvin',
          },
          data: {
            b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024,
            tb: 1024 * 1024 * 1024 * 1024,
          },
        };

        const val = typeof value === 'number' ? value : parseFloat(value as string);
        const fromUnit = (from as string).toLowerCase();
        const toUnit = (to as string).toLowerCase();

        for (const category of Object.values(conversions)) {
          if (category[fromUnit] !== undefined && category[toUnit] !== undefined) {
            const fromValue = category[fromUnit];
            const toValue = category[toUnit];
            if (typeof fromValue === 'string' || typeof toValue === 'string') {
              let celsius: number;
              if (fromUnit === 'c') celsius = val;
              else if (fromUnit === 'f') celsius = (val - 32) * 5 / 9;
              else celsius = val - 273.15;

              let result: number;
              if (toUnit === 'c') result = celsius;
              else if (toUnit === 'f') result = celsius * 9 / 5 + 32;
              else result = celsius + 273.15;

              return JSON.stringify({
                success: true,
                value: val,
                from: from as string,
                to: to as string,
                result: Math.round(result * 100) / 100,
              });
            } else {
              const baseValue = val * fromValue;
              const result = baseValue / toValue;
              return JSON.stringify({
                success: true,
                value: val,
                from: from as string,
                to: to as string,
                result: Math.round(result * 1000000) / 1000000,
              });
            }
          }
        }

        return JSON.stringify({ error: 'Unsupported unit conversion' });
      }

      case 'percentage': {
        const { value, percentage, of } = args;
        if (value === undefined || percentage === undefined) {
          return JSON.stringify({ error: 'value and percentage are required' });
        }

        const val = typeof value === 'number' ? value : parseFloat(value as string);
        const pct = typeof percentage === 'number' ? percentage : parseFloat(percentage as string);

        if (of !== undefined) {
          const ofVal = typeof of === 'number' ? of : parseFloat(of as string);
          const result = (val / ofVal) * 100;
          return JSON.stringify({
            success: true,
            type: 'percentage_of',
            value: val,
            of: ofVal,
            percentage: Math.round(result * 100) / 100,
          });
        }

        const result = val * (pct / 100);
        return JSON.stringify({
          success: true,
          type: 'percentage',
          value: val,
          percentage: pct,
          result: Math.round(result * 100) / 100,
        });
      }

      case 'statistics': {
        const { numbers } = args;
        if (!numbers || !Array.isArray(numbers)) {
          return JSON.stringify({ error: 'numbers array is required' });
        }

        const nums = numbers.map((n: any) => typeof n === 'number' ? n : parseFloat(n));
        const sum = nums.reduce((a: number, b: number) => a + b, 0);
        const avg = sum / nums.length;
        const sorted = [...nums].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = nums.length % 2 === 0
          ? (sorted[nums.length / 2 - 1] + sorted[nums.length / 2]) / 2
          : sorted[Math.floor(nums.length / 2)];
        const variance = nums.reduce((acc: number, val: number) => acc + Math.pow(val - avg, 2), 0) / nums.length;
        const stdDev = Math.sqrt(variance);

        return JSON.stringify({
          success: true,
          count: nums.length,
          sum: Math.round(sum * 1000000) / 1000000,
          average: Math.round(avg * 1000000) / 1000000,
          median: Math.round(median * 1000000) / 1000000,
          min,
          max,
          variance: Math.round(variance * 1000000) / 1000000,
          standardDeviation: Math.round(stdDev * 1000000) / 1000000,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${actionName}` });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message, success: false });
  }
};

export const CalculatorToolDefinition = {
  name: 'calculator',
  description: 'Perform mathematical calculations, unit conversions, percentage calculations, and statistical analysis',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['calculate', 'convert', 'percentage', 'statistics'],
        description: 'Calculation type to perform',
      },
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (supports +, -, *, /, ^, sin, cos, tan, sqrt, log, ln, exp, pi, e)',
      },
      precision: {
        type: 'number',
        description: 'Number of decimal places (default: 10)',
      },
      value: {
        type: 'number',
        description: 'Value for conversion or percentage calculation',
      },
      from: {
        type: 'string',
        description: 'Source unit for conversion',
      },
      to: {
        type: 'string',
        description: 'Target unit for conversion',
      },
      percentage: {
        type: 'number',
        description: 'Percentage value',
      },
      of: {
        type: 'number',
        description: 'Base value for calculating percentage',
      },
      numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of numbers for statistical analysis',
      },
    },
    required: ['action'],
  },
};