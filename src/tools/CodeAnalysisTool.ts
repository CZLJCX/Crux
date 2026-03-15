import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, basename } from 'path';
import type { ToolExecuteFunc } from '../core/types.js';

interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'import' | 'export';
  line: number;
  endLine?: number;
  params?: string[];
  returnType?: string;
  modifiers?: string[];
  docstring?: string;
}

interface FileAnalysis {
  path: string;
  language: string;
  lineCount: number;
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
  complexity?: number;
}

interface LanguagePatterns {
  function: RegExp[];
  class: RegExp[];
  interface: RegExp[];
  variable: RegExp[];
  constant: RegExp[];
  import: RegExp[];
  export: RegExp[];
  comment: RegExp;
}

const LANGUAGE_PATTERNS: Record<string, LanguagePatterns> = {
  typescript: {
    function: [
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm,
      /^(?:export\s+)?(?:async\s+)?(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)\s*(?::\s*([^,{]+))?\s*\{/gm,
      /^(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^,{]+))?/gm,
    ],
    class: [/^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?/gm],
    interface: [/^(?:export\s+)?interface\s+(\w+)/gm],
    variable: [/^(?:export\s+)?(?:let|var)\s+(\w+)\s*=/gm],
    constant: [/^(?:export\s+)?const\s+(\w+)\s*=/gm],
    import: [/^import\s+.*?from\s+['"]([^'"]+)['"]/gm, /^import\s+['"]([^'"]+)['"]/gm],
    export: [/^export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/gm],
    comment: /(\/\*[\s\S]*?\*\/|\/\/.*$)/gm,
  },
  javascript: {
    function: [
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm,
      /^(?:export\s+)?(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/gm,
      /^(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)/gm,
    ],
    class: [/^(?:export\s+)?class\s+(\w+)/gm],
    interface: [],
    variable: [/^(?:export\s+)?(?:let|var)\s+(\w+)\s*=/gm],
    constant: [/^(?:export\s+)?const\s+(\w+)\s*=/gm],
    import: [/^import\s+.*?from\s+['"]([^'"]+)['"]/gm, /^import\s+['"]([^'"]+)['"]/gm],
    export: [/^export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/gm],
    comment: /(\/\*[\s\S]*?\*\/|\/\/.*$)/gm,
  },
  python: {
    function: [/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm],
    class: [/^class\s+(\w+)(?:\([^)]*\))?/gm],
    interface: [/^class\s+(\w+)(?:\(.*?(?:Protocol|ABC|Interface).*?\))?/gm],
    variable: [/^(\w+)\s*=\s*(?!.*def|.*class)/gm],
    constant: [/^([A-Z_][A-Z0-9_]*)\s*=/gm],
    import: [/^import\s+(\w+)|^from\s+(\w+)\s+import/gm],
    export: [],
    comment: /(#.*$|"""[\s\S]*?"""|'''[\s\S]*?''')/gm,
  },
};

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.py': 'python',
  };
  return langMap[ext] || 'javascript';
}

function extractSymbols(code: string, language: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;

  const codeWithoutComments = code.replace(patterns.comment, '');

  for (const regex of patterns.function) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(codeWithoutComments)) !== null) {
      const beforeMatch = codeWithoutComments.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      symbols.push({
        name: match[1],
        type: 'function',
        line: lineNumber,
        params: match[2] ? match[2].split(',').map(p => p.trim()).filter(Boolean) : [],
        returnType: match[3]?.trim(),
      });
    }
  }

  for (const regex of patterns.class) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(codeWithoutComments)) !== null) {
      const beforeMatch = codeWithoutComments.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      symbols.push({
        name: match[1],
        type: 'class',
        line: lineNumber,
      });
    }
  }

  for (const regex of patterns.interface) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(codeWithoutComments)) !== null) {
      const beforeMatch = codeWithoutComments.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      symbols.push({
        name: match[1],
        type: 'interface',
        line: lineNumber,
      });
    }
  }

  for (const regex of patterns.constant) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(codeWithoutComments)) !== null) {
      const beforeMatch = codeWithoutComments.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      symbols.push({
        name: match[1],
        type: 'constant',
        line: lineNumber,
      });
    }
  }

  return symbols.sort((a, b) => a.line - b.line);
}

function extractImports(code: string, language: string): string[] {
  const imports: string[] = [];
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;

  for (const regex of patterns.import) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(code)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath) {
        imports.push(importPath);
      }
    }
  }

  return [...new Set(imports)];
}

function extractExports(code: string, language: string): string[] {
  const exports: string[] = [];
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;

  for (const regex of patterns.export) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(code)) !== null) {
      if (match[1]) {
        exports.push(match[1]);
      }
    }
  }

  return [...new Set(exports)];
}

function calculateComplexity(code: string): number {
  let complexity = 1;

  const controlPatterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*:/g,
    /&&/g,
    /\|\|/g,
  ];

  for (const pattern of controlPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

export const CodeAnalysisTool: ToolExecuteFunc = async (args: Record<string, unknown>) => {
  const { action, file, files, extract, language } = args;
  const actionName = (action as string) || 'parse';

  try {
    switch (actionName) {
      case 'parse': {
        const filePath = file as string | undefined;
        if (!filePath) {
          return JSON.stringify({ error: 'file path is required' });
        }

        if (!existsSync(filePath)) {
          return JSON.stringify({ error: `File not found: ${filePath}` });
        }

        const content = await readFile(filePath, 'utf-8');
        const lang = (language as string) || detectLanguage(filePath);
        const symbols = extractSymbols(content, lang);
        const imports = extractImports(content, lang);
        const exports = extractExports(content, lang);
        const complexity = calculateComplexity(content);

        const result: FileAnalysis = {
          path: filePath,
          language: lang,
          lineCount: content.split('\n').length,
          symbols,
          imports,
          exports,
          complexity,
        };

        if (extract && Array.isArray(extract)) {
          const filtered: Record<string, unknown> = { path: filePath };
          for (const key of extract as string[]) {
            if (key in result) {
              filtered[key] = (result as unknown as Record<string, unknown>)[key];
            }
          }
          return JSON.stringify({ success: true, analysis: filtered });
        }

        return JSON.stringify({ success: true, analysis: result });
      }

      case 'parse_multiple': {
        const filesList = files as string[] | undefined;
        if (!filesList || !Array.isArray(filesList)) {
          return JSON.stringify({ error: 'files array is required' });
        }

        const results: FileAnalysis[] = [];
        const lang = language as string | undefined;

        for (const filePath of filesList) {
          if (!existsSync(filePath)) continue;

          const content = await readFile(filePath, 'utf-8');
          const detectedLang = lang || detectLanguage(filePath);

          results.push({
            path: filePath,
            language: detectedLang,
            lineCount: content.split('\n').length,
            symbols: extractSymbols(content, detectedLang),
            imports: extractImports(content, detectedLang),
            exports: extractExports(content, detectedLang),
            complexity: calculateComplexity(content),
          });
        }

        return JSON.stringify({
          success: true,
          fileCount: results.length,
          results,
        });
      }

      case 'outline': {
        const filePath = file as string | undefined;
        if (!filePath) {
          return JSON.stringify({ error: 'file path is required' });
        }

        if (!existsSync(filePath)) {
          return JSON.stringify({ error: `File not found: ${filePath}` });
        }

        const content = await readFile(filePath, 'utf-8');
        const lang = (language as string) || detectLanguage(filePath);
        const symbols = extractSymbols(content, lang);

        const outline = symbols.map(s => {
          const indent = s.type === 'function' ? '  ' : '';
          const typeIcons: Record<string, string> = {
            function: 'ƒ',
            class: 'C',
            interface: 'I',
            constant: 'K',
            variable: 'v',
          };
          const typeIcon = typeIcons[s.type] || '?';

          const params = s.params?.length ? `(${s.params.join(', ')})` : '';
          const returnType = s.returnType ? `: ${s.returnType}` : '';

          return `${indent}${typeIcon} ${s.name}${params}${returnType} (line ${s.line})`;
        });

        return JSON.stringify({
          success: true,
          file: filePath,
          language: lang,
          outline,
          symbolCount: symbols.length,
        });
      }

      case 'stats': {
        const filePath = file as string | undefined;
        if (!filePath) {
          return JSON.stringify({ error: 'file path is required' });
        }

        if (!existsSync(filePath)) {
          return JSON.stringify({ error: `File not found: ${filePath}` });
        }

        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const lang = (language as string) || detectLanguage(filePath);
        const symbols = extractSymbols(content, lang);
        const stats = await stat(filePath);

        const typeCount: Record<string, number> = {};
        for (const s of symbols) {
          typeCount[s.type] = (typeCount[s.type] || 0) + 1;
        }

        return JSON.stringify({
          success: true,
          file: filePath,
          language: lang,
          stats: {
            totalLines: lines.length,
            codeLines: lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#')).length,
            commentLines: lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('/*') || l.trim().startsWith('*')).length,
            blankLines: lines.filter(l => !l.trim()).length,
            totalSymbols: symbols.length,
            symbolTypes: typeCount,
            complexity: calculateComplexity(content),
            fileSize: stats.size,
          },
        });
      }

      case 'dependencies': {
        const filePath = file as string | undefined;
        if (!filePath) {
          return JSON.stringify({ error: 'file path is required' });
        }

        if (!existsSync(filePath)) {
          return JSON.stringify({ error: `File not found: ${filePath}` });
        }

        const content = await readFile(filePath, 'utf-8');
        const lang = (language as string) || detectLanguage(filePath);
        const imports = extractImports(content, lang);

        const dependencies = imports.map(imp => {
          const isLocal = imp.startsWith('.') || imp.startsWith('/');
          const packageName = isLocal ? null : imp.split('/')[0];

          return {
            import: imp,
            isLocal,
            packageName,
          };
        });

        const externalPackages = dependencies
          .filter(d => !d.isLocal && d.packageName)
          .map(d => d.packageName);

        return JSON.stringify({
          success: true,
          file: filePath,
          language: lang,
          imports,
          dependencies,
          externalPackages: [...new Set(externalPackages)],
          localImports: dependencies.filter(d => d.isLocal).map(d => d.import),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${actionName}` });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return JSON.stringify({ error: message, success: false });
  }
};

export const CodeAnalysisToolDefinition = {
  name: 'code_analysis',
  description: 'Analyze code files: parse structure, extract symbols (functions, classes, interfaces), calculate complexity, get file stats, analyze dependencies.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['parse', 'parse_multiple', 'outline', 'stats', 'dependencies'],
        description: 'Analysis action to perform',
      },
      file: {
        type: 'string',
        description: 'File path to analyze',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple file paths to analyze',
      },
      extract: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fields to extract: symbols, imports, exports, complexity',
      },
      language: {
        type: 'string',
        description: 'Force language (auto-detected if not specified)',
      },
    },
    required: ['action'],
  },
};