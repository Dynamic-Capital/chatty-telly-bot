import { useState } from 'react';

export default function CopyableText({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className || ''}`}>
      <span className="truncate">{text}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy to clipboard"
        className="p-1 rounded hover:bg-slate-200 focus:outline-none focus:ring"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
      {copied && (
        <span role="status" className="text-xs text-green-600">
          Copied!
        </span>
      )}
    </div>
  );
}

