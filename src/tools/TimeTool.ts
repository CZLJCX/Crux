import { ToolExecuteFunc } from '../core/types.js';

export const TimeTool: ToolExecuteFunc = async (args: Record<string, unknown>) => {
  const { action, timezone, format, timestamp } = args;
  const actionName = action as string || 'now';

  try {
    switch (actionName) {
      case 'now': {
        const now = new Date();
        const tz = timezone as string || 'local';
        const options: Intl.DateTimeFormatOptions = {
          timeZone: tz === 'local' ? undefined : tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          weekday: 'long',
          hour12: false,
        };
        
        const formatted = now.toLocaleString('zh-CN', options);
        const iso = now.toISOString();
        const unix = Math.floor(now.getTime() / 1000);
        
        return JSON.stringify({
          success: true,
          local: formatted,
          iso,
          unix,
          timezone: tz,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          weekday: now.getDay(),
          hour: now.getHours(),
          minute: now.getMinutes(),
          second: now.getSeconds(),
        });
      }

      case 'convert': {
        if (!timestamp) {
          return JSON.stringify({ error: 'timestamp is required for convert action' });
        }
        
        const ts = typeof timestamp === 'number' ? timestamp : parseInt(timestamp as string);
        const date = new Date(ts * 1000);
        const tz = timezone as string || 'local';
        const options: Intl.DateTimeFormatOptions = {
          timeZone: tz === 'local' ? undefined : tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        };
        
        return JSON.stringify({
          success: true,
          input: ts,
          local: date.toLocaleString('zh-CN', options),
          iso: date.toISOString(),
          timezone: tz,
        });
      }

      case 'format': {
        const now = new Date();
        const fmt = format as string || 'YYYY-MM-DD HH:mm:ss';
        
        const replacements: Record<string, string> = {
          'YYYY': String(now.getFullYear()),
          'YY': String(now.getFullYear()).slice(-2),
          'MM': String(now.getMonth() + 1).padStart(2, '0'),
          'M': String(now.getMonth() + 1),
          'DD': String(now.getDate()).padStart(2, '0'),
          'D': String(now.getDate()),
          'HH': String(now.getHours()).padStart(2, '0'),
          'H': String(now.getHours()),
          'mm': String(now.getMinutes()).padStart(2, '0'),
          'm': String(now.getMinutes()),
          'ss': String(now.getSeconds()).padStart(2, '0'),
          's': String(now.getSeconds()),
          'dddd': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
          'ddd': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()],
        };
        
        let result = fmt;
        for (const [key, value] of Object.entries(replacements)) {
          result = result.replace(new RegExp(key, 'g'), value);
        }
        
        return JSON.stringify({
          success: true,
          formatted: result,
          format: fmt,
        });
      }

      case 'diff': {
        const { startTime, endTime } = args;
        if (!startTime || !endTime) {
          return JSON.stringify({ error: 'startTime and endTime are required for diff action' });
        }
        
        const start = new Date(startTime as string);
        const end = new Date(endTime as string);
        const diffMs = Math.abs(end.getTime() - start.getTime());
        
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        return JSON.stringify({
          success: true,
          milliseconds: diffMs,
          days,
          hours,
          minutes,
          seconds,
          totalHours: Math.floor(diffMs / (1000 * 60 * 60)),
          totalMinutes: Math.floor(diffMs / (1000 * 60)),
          totalSeconds: Math.floor(diffMs / 1000),
        });
      }

      case 'zones': {
        const zones = [
          { name: 'UTC', offset: 0 },
          { name: 'Asia/Shanghai', offset: 8 },
          { name: 'Asia/Tokyo', offset: 9 },
          { name: 'America/New_York', offset: -5 },
          { name: 'America/Los_Angeles', offset: -8 },
          { name: 'Europe/London', offset: 0 },
          { name: 'Europe/Paris', offset: 1 },
          { name: 'Australia/Sydney', offset: 11 },
        ];
        
        const now = new Date();
        const results = zones.map(z => {
          const options: Intl.DateTimeFormatOptions = {
            timeZone: z.name,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          };
          return {
            name: z.name,
            offset: z.offset,
            time: now.toLocaleString('zh-CN', options),
          };
        });
        
        return JSON.stringify({
          success: true,
          zones: results,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${actionName}` });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message, success: false });
  }
};

export const TimeToolDefinition = {
  name: 'time',
  description: 'Get current time, convert timestamps, format dates, calculate time differences, and list timezones',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['now', 'convert', 'format', 'diff', 'zones'],
        description: 'Time operation to perform',
      },
      timezone: {
        type: 'string',
        description: 'Timezone (e.g., Asia/Shanghai, America/New_York)',
      },
      format: {
        type: 'string',
        description: 'Date format string (e.g., YYYY-MM-DD HH:mm:ss)',
      },
      timestamp: {
        type: 'number',
        description: 'Unix timestamp to convert',
      },
      startTime: {
        type: 'string',
        description: 'Start time for diff calculation (ISO format or timestamp)',
      },
      endTime: {
        type: 'string',
        description: 'End time for diff calculation (ISO format or timestamp)',
      },
    },
    required: ['action'],
  },
};