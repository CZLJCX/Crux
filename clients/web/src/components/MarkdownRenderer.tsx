import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  darkMode?: boolean;
}

interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function MarkdownRenderer({ content, darkMode = false }: MarkdownRendererProps) {
  const components = {
    code({ node, inline, className, children, ...props }: CodeProps) {
      const match = /language-(\w+)(?::(.+))?/.exec(className || '');
      const language = match ? match[1] : '';
      const filename = match ? match[2] : undefined;
      
      if (!inline && (match || String(children).includes('\n'))) {
        return (
          <CodeBlock 
            language={language} 
            filename={filename}
            darkMode={darkMode}
          >
            {String(children).replace(/\n$/, '')}
          </CodeBlock>
        );
      }
      
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );
    },
    pre({ children }: any) {
      return <>{children}</>;
    },
    a({ href, children }: any) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="markdown-link">
          {children}
        </a>
      );
    },
    table({ children }: any) {
      return (
        <div className="markdown-table-wrapper">
          <table className="markdown-table">{children}</table>
        </div>
      );
    },
    blockquote({ children }: any) {
      return <blockquote className="markdown-blockquote">{children}</blockquote>;
    },
    ul({ children }: any) {
      return <ul className="markdown-list">{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className="markdown-list ordered">{children}</ol>;
    },
    li({ children, checked }: any) {
      if (checked !== null && checked !== undefined) {
        return (
          <li className="markdown-task-item">
            <input type="checkbox" checked={checked} readOnly />
            <span>{children}</span>
          </li>
        );
      }
      return <li className="markdown-list-item">{children}</li>;
    },
    h1({ children }: any) {
      return <h1 className="markdown-heading h1">{children}</h1>;
    },
    h2({ children }: any) {
      return <h2 className="markdown-heading h2">{children}</h2>;
    },
    h3({ children }: any) {
      return <h3 className="markdown-heading h3">{children}</h3>;
    },
    h4({ children }: any) {
      return <h4 className="markdown-heading h4">{children}</h4>;
    },
    h5({ children }: any) {
      return <h5 className="markdown-heading h5">{children}</h5>;
    },
    h6({ children }: any) {
      return <h6 className="markdown-heading h6">{children}</h6>;
    },
    p({ children }: any) {
      return <p className="markdown-paragraph">{children}</p>;
    },
    hr() {
      return <hr className="markdown-hr" />;
    },
    img({ src, alt }: any) {
      return (
        <figure className="markdown-figure">
          <img src={src} alt={alt} className="markdown-image" loading="lazy" />
          {alt && <figcaption className="markdown-caption">{alt}</figcaption>}
        </figure>
      );
    },
    del({ children }: any) {
      return <del className="markdown-del">{children}</del>;
    },
    strong({ children }: any) {
      return <strong className="markdown-strong">{children}</strong>;
    },
    em({ children }: any) {
      return <em className="markdown-em">{children}</em>;
    },
  };

  return (
    <div className={`markdown-body ${darkMode ? 'dark' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}