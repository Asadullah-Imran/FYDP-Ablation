'use client';
import { useEffect, useState, useId, useRef } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;

function ensureMermaidInitialized() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: 13,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });
    mermaidInitialized = true;
  }
}

export default function MermaidRenderer({ chart, className = '' }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const reactId = useId();
  const containerRef = useRef(null);

  // Generate unique HTML ID for mermaid SVG (valid CSS ID without special chars)
  const svgId = 'mermaid-' + reactId.replace(/[^a-zA-Z0-9_-]/g, '');

  useEffect(() => {
    let active = true;
    ensureMermaidInitialized();

    const renderDiagram = async () => {
      if (!chart || !chart.trim()) {
        setSvg('');
        setError(null);
        return;
      }

      try {
        setError(null);
        const code = chart.trim();
        const { svg: svgOutput } = await mermaid.render(svgId, code);
        if (active) {
          setSvg(svgOutput);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (active) {
          setError(err?.message || 'Error rendering diagram');
        }
      } finally {
        // Clean up temporary elements mermaid attaches to body during render
        const tempElement = document.getElementById(svgId);
        if (tempElement) {
          tempElement.remove();
        }
        const dElement = document.getElementById('d' + svgId);
        if (dElement) {
          dElement.remove();
        }
      }
    };

    renderDiagram();

    return () => {
      active = false;
    };
  }, [chart, svgId]);

  if (error) {
    return (
      <div className="my-4 p-4 bg-error-container/10 border border-error-container/30 rounded-default text-xs font-mono text-error overflow-x-auto space-y-2">
        <div className="font-bold font-sans flex items-center gap-1.5 text-error">
          <span>⚠️ Invalid Diagram Syntax</span>
        </div>
        <pre className="text-on-surface-variant/80 text-[11px] whitespace-pre-wrap leading-relaxed">{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 p-6 bg-surface-container-low border border-outline-border/60 rounded-default flex items-center justify-center text-xs text-on-surface-variant animate-pulse">
        Generating flow diagram...
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`my-4 bg-surface-container-low p-4 sm:p-6 rounded-default border border-outline-border overflow-x-auto flex justify-center shadow-sm ${className}`}
    >
      <div 
        className="mermaid-wrapper w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:mx-auto"
        dangerouslySetInnerHTML={{ __html: svg }} 
      />
    </div>
  );
}
