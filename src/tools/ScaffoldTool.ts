import { writeFile, mkdir, stat, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import type { ToolExecuteFunc } from '../core/types.js';

interface Template {
  name: string;
  description: string;
  files: Array<{ path: string; content: string }>;
}

const TEMPLATES: Record<string, Template> = {
  'react-ts': {
    name: 'React + TypeScript',
    description: 'React application with TypeScript',
    files: [
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react';

interface Props {
  title?: string;
}

export function App({ title = 'React App' }: Props) {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>{title}</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </div>
  );
}

export default App;
`,
      },
      {
        path: 'src/main.tsx',
        content: `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`,
      },
      {
        path: 'src/index.css',
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; }
.app { padding: 2rem; }
`,
      },
    ],
  },
  'node-api': {
    name: 'Node.js API',
    description: 'Express REST API with TypeScript',
    files: [
      {
        path: 'src/index.ts',
        content: `import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/items', async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`,
      },
    ],
  },
  'fastapi': {
    name: 'FastAPI',
    description: 'Python FastAPI application',
    files: [
      {
        path: 'src/main.py',
        content: `from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="API", version="1.0.0")

class Item(BaseModel):
    name: str
    value: float | None = None

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/items")
async def list_items():
    return {"success": True, "data": []}

@app.post("/api/items")
async def create_item(item: Item):
    return {"success": True, data: item}
`,
      },
      {
        path: 'requirements.txt',
        content: `fastapi>=0.100.0
uvicorn>=0.23.0
pydantic>=2.0.0
`,
      },
    ],
  },
  'cli': {
    name: 'CLI Tool',
    description: 'Node.js CLI application',
    files: [
      {
        path: 'src/index.ts',
        content: `#!/usr/bin/env node

interface Options {
  help?: boolean;
  version?: boolean;
}

function parseArgs(args: string[]): Options {
  return {
    help: args.includes('-h') || args.includes('--help'),
    version: args.includes('-v') || args.includes('--version'),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    console.log(\`
Usage: cli [options]

Options:
  -h, --help     Show help
  -v, --version  Show version
\`);
    process.exit(0);
  }

  if (options.version) {
    console.log('1.0.0');
    process.exit(0);
  }

  console.log('Hello, World!');
}

main().catch(console.error);
`,
      },
    ],
  },
};

const CONFIG_TEMPLATES: Record<string, string> = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }, null, 2),

  'package.json': JSON.stringify({
    name: 'project',
    version: '1.0.0',
    type: 'module',
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js',
      dev: 'tsx watch src/index.ts',
    },
    dependencies: {},
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
      tsx: '^4.0.0',
    },
  }, null, 2),

  '.gitignore': `node_modules/
dist/
.env
*.log
.DS_Store
`,

  '.env.example': `# Environment variables
API_KEY=your-api-key
PORT=3000
`,

  'README.md': `# Project

## Setup

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`
`,
};

const COMPONENT_TEMPLATES: Record<string, (name: string) => string> = {
  'react-component': (name) => `import { useState } from 'react';

interface ${name}Props {
  className?: string;
}

export function ${name}({ className }: ${name}Props) {
  return (
    <div className={className}>
      {/* ${name} component */}
    </div>
  );
}
`,
  'react-hook': (name) => `import { useState, useCallback } from 'react';

export function ${name}() {
  const [state, setState] = useState(null);

  const action = useCallback(() => {
    // Implementation
  }, []);

  return { state, action };
}
`,
  'express-route': (name) => `import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
`,
  'python-class': (name) => `from dataclasses import dataclass
from typing import Optional

@dataclass
class ${name}:
    id: str
    name: str
    value: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "value": self.value
        }
`,
  'python-service': (name) => `from typing import List, Optional

class ${name}Service:
    async def get_all(self) -> List[dict]:
        # Implementation
        return []

    async def get_by_id(self, id: str) -> Optional[dict]:
        # Implementation
        return None

    async def create(self, data: dict) -> dict:
        # Implementation
        return data

${name}_service = ${name}Service()
`,
};

export const ScaffoldTool: ToolExecuteFunc = async (args: Record<string, unknown>) => {
  const { action, type, name, path, template, files, configs, overwrite } = args;
  const actionName = (action as string) || 'project';
  const typeName = type as string | undefined;

  const basePath = (path as string) || process.cwd();
  const projectPath = name ? join(basePath, name as string) : basePath;

  try {
    switch (actionName) {
      case 'project': {
        if (!typeName || !TEMPLATES[typeName]) {
          return JSON.stringify({
            error: `Unknown project type: ${typeName}`,
            availableTypes: Object.keys(TEMPLATES),
          });
        }

        const projectTemplate = TEMPLATES[typeName];

        if (!existsSync(projectPath)) {
          await mkdir(projectPath, { recursive: true });
        }

        for (const file of projectTemplate.files) {
          const filePath = join(projectPath, file.path);
          const dir = dirname(filePath);

          if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
          }

          if (!overwrite && existsSync(filePath)) {
            continue;
          }

          await writeFile(filePath, file.content, 'utf-8');
        }

        return JSON.stringify({
          success: true,
          type,
          path: projectPath,
          filesCreated: projectTemplate.files.map(f => f.path),
          message: `Project "${name || basename(projectPath)}" created with ${projectTemplate.files.length} files`,
        });
      }

      case 'component': {
        if (!typeName || !COMPONENT_TEMPLATES[typeName]) {
          return JSON.stringify({
            error: `Unknown component type: ${typeName}`,
            availableTypes: Object.keys(COMPONENT_TEMPLATES),
          });
        }

        if (!name) {
          return JSON.stringify({ error: 'Component name is required' });
        }

        const content = COMPONENT_TEMPLATES[typeName](name as string);
        const extensions: Record<string, string> = {
          'react-component': '.tsx',
          'react-hook': '.ts',
          'express-route': '.ts',
          'python-class': '.py',
          'python-service': '.py',
        };

        const ext = extensions[typeName] || '.ts';
        const fileName = `${name}${ext}`;
        const filePath = join(projectPath, fileName);

        if (!existsSync(projectPath)) {
          await mkdir(projectPath, { recursive: true });
        }

        if (!overwrite && existsSync(filePath)) {
          return JSON.stringify({ error: `File already exists: ${filePath}` });
        }

        await writeFile(filePath, content, 'utf-8');

        return JSON.stringify({
          success: true,
          type,
          name,
          path: filePath,
          content,
        });
      }

      case 'config': {
        if (!configs || !Array.isArray(configs)) {
          return JSON.stringify({
            error: 'configs array is required',
            availableConfigs: Object.keys(CONFIG_TEMPLATES),
          });
        }

        const created: string[] = [];

        for (const configName of configs) {
          if (!CONFIG_TEMPLATES[configName as string]) {
            continue;
          }

          const filePath = join(projectPath, configName);

          if (!overwrite && existsSync(filePath)) {
            continue;
          }

          await writeFile(filePath, CONFIG_TEMPLATES[configName as string], 'utf-8');
          created.push(configName);
        }

        return JSON.stringify({
          success: true,
          path: projectPath,
          configsCreated: created,
        });
      }

      case 'file': {
        if (!files || !Array.isArray(files)) {
          return JSON.stringify({ error: 'files array is required' });
        }

        const created: string[] = [];

        for (const file of files) {
          const filePath = join(projectPath, (file as any).path);
          const dir = dirname(filePath);

          if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
          }

          if (!overwrite && existsSync(filePath)) {
            continue;
          }

          await writeFile(filePath, (file as any).content || '', 'utf-8');
          created.push((file as any).path);
        }

        return JSON.stringify({
          success: true,
          path: projectPath,
          filesCreated: created,
        });
      }

      case 'list-templates': {
        return JSON.stringify({
          success: true,
          projectTemplates: Object.entries(TEMPLATES).map(([key, t]) => ({
            id: key,
            name: t.name,
            description: t.description,
            files: t.files.length,
          })),
          componentTemplates: Object.keys(COMPONENT_TEMPLATES),
          configTemplates: Object.keys(CONFIG_TEMPLATES),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${actionName}` });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message, success: false });
  }
};

export const ScaffoldToolDefinition = {
  name: 'scaffold',
  description: 'Create project scaffolds, components, and configuration files. Supports React, Node.js, FastAPI, and CLI templates.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['project', 'component', 'config', 'file', 'list-templates'],
        description: 'Scaffold action to perform',
      },
      type: {
        type: 'string',
        description: 'Template type: react-ts, node-api, fastapi, cli (for project) or react-component, react-hook, express-route, python-class (for component)',
      },
      name: {
        type: 'string',
        description: 'Project or component name',
      },
      path: {
        type: 'string',
        description: 'Target directory path',
      },
      template: {
        type: 'string',
        description: 'Custom template content',
      },
      files: {
        type: 'array',
        description: 'Files to create (for "file" action): [{ path, content }]',
      },
      configs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Config files to create: tsconfig.json, package.json, .gitignore, .env.example, README.md',
      },
      overwrite: {
        type: 'boolean',
        description: 'Overwrite existing files',
      },
    },
    required: ['action'],
  },
};