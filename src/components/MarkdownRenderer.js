'use client';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import MermaidRenderer from './MermaidRenderer';

export function preprocessMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  // Normalize carriage returns
  const normalized = text.replace(/\r\n/g, '\n');

  // Split by existing ``` code fences to avoid modifying already fenced code
  const codeFenceRegex = /(```[\s\S]*?```)/g;
  const parts = normalized.split(codeFenceRegex);

  return parts.map((part, index) => {
    // Odd indices are inside existing ``` code blocks
    if (index % 2 === 1) {
      // Standardize language identifier if specified as flowchart/graph etc.
      if (/^```(flowchart|graph|sequenceDiagram|gantt|classDiagram|stateDiagram|erDiagram|pie|mindmap)\b/i.test(part)) {
        return part.replace(/^```[a-zA-Z0-9_-]+/, '```mermaid');
      }
      return part;
    }

    // Even indices are raw markdown text outside code fences
    const lines = part.split('\n');
    const processedLines = [];
    let inUnfencedDiagram = false;
    let diagramBuffer = [];

    const isDiagramStart = (line) => {
      return /^\s*(flowchart(-v2)?|graph|sequenceDiagram|gantt|classDiagram|stateDiagram(-v2)?|erDiagram|pie|mindmap|gitGraph|C4Context|timeline|zenuml|sankey-beta|xychart-beta|block-beta)\b/i.test(line);
    };

    const isDiagramLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return true; // Spacing lines inside diagram block
      if (/^\s*(subgraph|end|classDef|style|linkStyle|click|direction|title|accTitle|accDescr)\b/i.test(trimmed)) return true;
      if (/-->|---|==>|-\.->|--\||\|-->|--\s*\||&|:::\b/.test(trimmed)) return true;
      if (/^[A-Za-z0-9_.-]+\s*(\[|\(|\{|\(\(|\]\)|-->|---|==>)/.test(trimmed)) return true;
      if (/^["'].*["']\s*(-->|---|==>)/.test(trimmed)) return true;
      if (/^\s{2,}\S/.test(line)) return true;
      return false;
    };

    const isClearNonDiagramLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^\s*#{1,6}\s+/.test(line)) return true; // Markdown headers
      if (/^\s*>\s+/.test(line)) return true; // Blockquotes
      if (/^\s*(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return true; // Horizontal rules
      if (/^\s*([0-9]+\.|\*|-|\+)\s+[A-Z]/.test(line) && !line.includes('-->')) return true; // Standard text list items
      return false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inUnfencedDiagram) {
        if (isDiagramStart(line)) {
          inUnfencedDiagram = true;
          diagramBuffer = [line];
        } else {
          processedLines.push(line);
        }
      } else {
        if (isClearNonDiagramLine(line)) {
          // Close diagram block
          while (diagramBuffer.length > 0 && !diagramBuffer[diagramBuffer.length - 1].trim()) {
            diagramBuffer.pop();
          }
          processedLines.push('```mermaid');
          processedLines.push(...diagramBuffer);
          processedLines.push('```');
          processedLines.push(line);
          inUnfencedDiagram = false;
          diagramBuffer = [];
        } else if (isDiagramLine(line)) {
          diagramBuffer.push(line);
        } else {
          // End of diagram block
          while (diagramBuffer.length > 0 && !diagramBuffer[diagramBuffer.length - 1].trim()) {
            diagramBuffer.pop();
          }
          processedLines.push('```mermaid');
          processedLines.push(...diagramBuffer);
          processedLines.push('```');
          processedLines.push(line);
          inUnfencedDiagram = false;
          diagramBuffer = [];
        }
      }
    }

    if (inUnfencedDiagram && diagramBuffer.length > 0) {
      while (diagramBuffer.length > 0 && !diagramBuffer[diagramBuffer.length - 1].trim()) {
        diagramBuffer.pop();
      }
      processedLines.push('```mermaid');
      processedLines.push(...diagramBuffer);
      processedLines.push('```');
    }

    return processedLines.join('\n');
  }).join('');
}

export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null;

  const processedContent = preprocessMarkdown(content);

  return (
    <div className={`prose max-w-none dark:prose-invert text-on-surface-variant leading-relaxed text-sm ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1].toLowerCase() : '';
            const codeString = String(children).replace(/\n$/, '');

            const isMermaidLang = ['mermaid', 'flowchart', 'graph', 'sequencediagram', 'gantt', 'classdiagram', 'statediagram', 'erdiagram', 'pie', 'mindmap'].includes(lang);
            const startsWithMermaid = /^\s*(flowchart(-v2)?|graph|sequenceDiagram|gantt|classDiagram|stateDiagram(-v2)?|erDiagram|pie|mindmap|gitGraph|C4Context|timeline|zenuml|sankey-beta|xychart-beta|block-beta)\b/i.test(codeString.trim());

            if (!inline && (isMermaidLang || startsWithMermaid)) {
              return <MermaidRenderer chart={codeString} />;
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            // Unwrap MermaidRenderer so pre tags don't nest around SVG
            return <div className="my-2">{children}</div>;
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
