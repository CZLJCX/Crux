import { useState, useCallback, useEffect } from 'react';

interface CodeBlockProps {
  language?: string;
  filename?: string;
  children: string;
  darkMode?: boolean;
}

const languageNames: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  go: 'Go',
  rs: 'Rust',
  rust: 'Rust',
  rb: 'Ruby',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  json: 'JSON',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  md: 'Markdown',
  markdown: 'Markdown',
  sh: 'Shell',
  bash: 'Bash',
  shell: 'Shell',
  ps1: 'PowerShell',
  powershell: 'PowerShell',
  docker: 'Docker',
  dockerfile: 'Dockerfile',
  vue: 'Vue',
  jsx: 'JSX',
  tsx: 'TSX',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  regex: 'Regex',
  diff: 'Diff',
  plaintext: 'Text',
  text: 'Text',
};

export function CodeBlock({ language, filename, children, darkMode = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [children]);

  const lines = children.split('\n');
  const displayLanguage = languageNames[language?.toLowerCase() || ''] || language || 'Code';
  const lineCount = lines.length;

  useEffect(() => {
    const styleId = 'highlight-js-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .hljs-comment,.hljs-quote{color:#6a737d}
        .hljs-variable,.hljs-template-variable,.hljs-attr,.hljs-tag,.hljs-name,.hljs-regexp,.hljs-link,.hljs-selector-id,.hljs-selector-class{color:#22863a}
        .hljs-number,.hljs-meta,.hljs-built_in,.hljs-builtin-name,.hljs-literal,.hljs-type,.hljs-params{color:#005cc5}
        .hljs-string,.hljs-symbol,.hljs-bullet{color:#032f62}
        .hljs-title,.hljs-section{color:#6f42c1}
        .hljs-keyword,.hljs-selector-tag{color:#d73a49}
        .hljs-deletion{background-color:#ffeef0;color:#b31d28}
        .hljs-addition{background-color:#e6ffed;color:#22863a}
        .hljs-emphasis{font-style:italic}
        .hljs-strong{font-weight:bold}
        .dark-theme .hljs-comment,.dark-theme .hljs-quote{color:#8b949e}
        .dark-theme .hljs-variable,.dark-theme .hljs-template-variable,.dark-theme .hljs-attr,.dark-theme .hljs-tag,.dark-theme .hljs-name,.dark-theme .hljs-regexp,.dark-theme .hljs-link,.dark-theme .hljs-selector-id,.dark-theme .hljs-selector-class{color:#7ee787}
        .dark-theme .hljs-number,.dark-theme .hljs-meta,.dark-theme .hljs-built_in,.dark-theme .hljs-builtin-name,.dark-theme .hljs-literal,.dark-theme .hljs-type,.dark-theme .hljs-params{color:#79c0ff}
        .dark-theme .hljs-string,.dark-theme .hljs-symbol,.dark-theme .hljs-bullet{color:#a5d6ff}
        .dark-theme .hljs-title,.dark-theme .hljs-section{color:#d2a8ff}
        .dark-theme .hljs-keyword,.dark-theme .hljs-selector-tag{color:#ff7b72}
        .dark-theme .hljs-deletion{background-color:#490202;color:#ffdcd7}
        .dark-theme .hljs-addition{background-color:#04260f;color:#aff5b4}
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div className={`code-block-wrapper ${darkMode ? 'dark' : ''}`}>
      <div className="code-block-header">
        <div className="code-block-info">
          <span className="code-block-lang">{displayLanguage}</span>
          {filename && <span className="code-block-filename">{filename}</span>}
          <span className="code-block-lines">{lineCount} lines</span>
        </div>
        <div className="code-block-actions">
          <button
            className="code-block-toggle"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            title="Toggle line numbers"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          <button
            className="code-block-copy"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="code-block-content">
        <pre className={`code-block-pre ${showLineNumbers ? 'with-line-numbers' : ''}`}>
          <code className={`code-block-code ${language ? `language-${language}` : ''}`}>
            {showLineNumbers ? (
              <table className="code-block-table">
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="code-block-line">
                      <td className="code-block-line-number">{index + 1}</td>
                      <td className="code-block-line-content">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              children
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}