'use client';

import {
  useState, useRef, useEffect, useMemo, useId, FormEvent, DragEvent, KeyboardEvent,
} from 'react';
import {
  Send, Trash2, AlertCircle, Plus, FileText, MessageSquarePlus,
  ArrowUp, Loader2, Check, ChevronRight, Copy, Link2, X, Menu,
  BookOpen, Sparkles, Zap,
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/backend';

// ════════════════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════════════════
interface Source {
  id: number;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  id: string;
}

interface Document {
  document_id: string;
  filename: string;
}

// ════════════════════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════════════════════
const cx = (...a: Parameters<typeof clsx>) => twMerge(clsx(a));

// ════════════════════════════════════════════════════════════════════════════
//  LOGO — animated teal document-search mark
// ════════════════════════════════════════════════════════════════════════════
function Logo({ className = 'w-4 h-4', animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg
      className={cx(className, animated && 'animate-logo-breathe')}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="10.5" cy="14.5" r="2.5"
        stroke="currentColor" strokeWidth="1.5"
      />
      <path
        d="M13 17l1.8 1.8"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  RELEVANCE BAR
// ════════════════════════════════════════════════════════════════════════════
function Relevance({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((score ?? 0) * 100)));
  const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--accent)' : 'var(--fg-subtle)';
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--fg-subtle)' }}>
      <span
        style={{
          display: 'inline-block',
          width: '32px',
          height: '3px',
          borderRadius: '9999px',
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: '9999px',
            transition: 'width 400ms var(--ease-soft)',
          }}
        />
      </span>
      <span style={{ fontSize: 'var(--t-xs)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
        {pct}%
      </span>
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SOURCE CHIP
// ════════════════════════════════════════════════════════════════════════════
function SourceChip({
  source, index, open, onToggle,
}: { source: Source; index: number; open: boolean; onToggle: () => void; }) {
  const file = source.metadata?.filename ?? 'Document';
  const page = source.metadata?.page_number ?? null;
  const preview = source.content.slice(0, 320);

  return (
    <div
      style={{
        borderRadius: 'var(--r-md)',
        border: `1px solid ${open ? 'var(--border-focus)' : 'var(--border)'}`,
        background: open ? 'var(--accent-soft)' : 'var(--surface)',
        transition: 'border-color var(--t-fast), background var(--t-fast)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          textAlign: 'left',
          background: 'none',
        }}
      >
        {/* Index badge */}
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: 'var(--r-sm)',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontSize: 'var(--t-xs)',
            fontFamily: 'var(--font-mono)',
            fontWeight: '600',
            border: '1px solid var(--accent-ring)',
          }}
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'var(--t-sm)',
              fontWeight: '500',
              color: 'var(--fg)',
            }}
          >
            {file}
          </span>
          <span style={{ display: 'block', fontSize: 'var(--t-xs)', color: 'var(--fg-subtle)' }}>
            {page ? `page ${page}` : 'page unknown'}
          </span>
        </span>
        <Relevance score={source.score} />
        <ChevronRight
          style={{
            width: '13px',
            height: '13px',
            color: 'var(--fg-subtle)',
            flexShrink: 0,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform var(--t-fast)',
          }}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', marginTop: '-2px' }}>
          <p
            style={{
              fontSize: 'var(--t-sm)',
              lineHeight: '1.65',
              color: 'var(--fg-muted)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              borderTop: '1px solid var(--border)',
              paddingTop: '10px',
            }}
          >
            {preview}
            {source.content.length > 320 && (
              <span style={{ color: 'var(--fg-subtle)' }}> …</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MESSAGE
// ════════════════════════════════════════════════════════════════════════════
function MessageItem({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const [openSources, setOpenSources] = useState<Set<number>>(new Set([0]));
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* blocked, safe to ignore */ }
  };

  const toggleSource = (i: number) =>
    setOpenSources((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <div
      className="animate-fade-up"
      style={{
        display: 'flex',
        gap: '12px',
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      {/* Avatar — assistant only */}
      {!isUser && (
        <div
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: '28px',
            height: '28px',
            borderRadius: 'var(--r-md)',
            background: 'var(--accent-soft)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}
        >
          <Logo className="w-3.5 h-3.5" />
        </div>
      )}

      <div style={{ minWidth: 0, ...(isUser ? { maxWidth: '78%' } : { flex: 1, maxWidth: '640px' }) }}>
        {/* Role label — assistant only */}
        {!isUser && (
          <div
            style={{
              fontSize: 'var(--t-xs)',
              fontWeight: '600',
              color: 'var(--fg-subtle)',
              marginBottom: '6px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Assistant
          </div>
        )}

        {/* Content */}
        {isUser ? (
          <div
            style={{
              display: 'inline-block',
              maxWidth: '100%',
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              padding: '10px 14px',
              borderRadius: 'var(--r-lg)',
              borderBottomRightRadius: 'var(--r-sm)',
              fontSize: 'var(--t-base)',
              lineHeight: '1.55',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {message.content}
          </div>
        ) : (
          <div className="group" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Text */}
            <div
              style={{
                fontSize: 'var(--t-base)',
                lineHeight: '1.7',
                color: 'var(--fg)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
              {isStreaming && message.content && (
                <span
                  className="animate-caret"
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '1em',
                    background: 'var(--accent)',
                    marginLeft: '2px',
                    verticalAlign: 'middle',
                    borderRadius: '1px',
                  }}
                />
              )}
              {isStreaming && !message.content && (
                <span className="dot-typing" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span /><span /><span />
                </span>
              )}
            </div>

            {/* Sources */}
            {message.sources && message.sources.length > 0 && !isStreaming && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: 'var(--t-xs)',
                    fontWeight: '600',
                    color: 'var(--fg-subtle)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <Link2 style={{ width: '11px', height: '11px' }} aria-hidden="true" />
                  <span>{message.sources.length} {message.sources.length === 1 ? 'source' : 'sources'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {message.sources.map((s, i) => (
                    <SourceChip
                      key={i}
                      source={s}
                      index={i}
                      open={openSources.has(i)}
                      onToggle={() => toggleSource(i)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Hover actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: 0,
                transition: 'opacity var(--t-fast)',
              }}
              className="group-hover:opacity-100 focus-within:opacity-100"
            >
              <button
                type="button"
                onClick={copy}
                aria-label={copied ? 'Copied' : 'Copy message'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 8px',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--t-xs)',
                  color: 'var(--fg-muted)',
                  background: 'none',
                  transition: 'background var(--t-fast), color var(--t-fast)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--bg-subtle)';
                  e.currentTarget.style.color = 'var(--fg)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--fg-muted)';
                }}
              >
                {copied
                  ? <Check style={{ width: '12px', height: '12px', color: 'var(--success)' }} aria-hidden="true" />
                  : <Copy style={{ width: '12px', height: '12px' }} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  COMPOSER
// ════════════════════════════════════════════════════════════════════════════
function Composer({
  value, onChange, onSubmit, disabled, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 240)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit(e as unknown as FormEvent);
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form onSubmit={onSubmit} role="search" aria-label="Ask a question">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          borderRadius: 'var(--r-xl)',
          border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border)'}`,
          background: 'var(--surface-3)',
          boxShadow: focused
            ? `0 0 0 3px var(--accent-ring), var(--shadow-md)`
            : 'var(--shadow-sm)',
          transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 12px 8px' }}>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="Question"
            style={{
              flex: 1,
              resize: 'none',
              background: 'transparent',
              fontSize: 'var(--t-base)',
              lineHeight: '1.5',
              padding: '6px 4px',
              maxHeight: '240px',
              color: 'var(--fg)',
              scrollMarginTop: '8px',
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send question"
            title="Send (Enter)"
            style={{
              flexShrink: 0,
              width: '34px',
              height: '34px',
              borderRadius: 'var(--r-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: canSend ? 'var(--accent)' : 'var(--bg-subtle)',
              color: canSend ? 'var(--accent-fg)' : 'var(--fg-subtle)',
              transition: 'background var(--t-fast), color var(--t-fast), transform var(--t-instant)',
              transform: canSend ? 'scale(1)' : 'scale(0.95)',
              boxShadow: canSend ? '0 2px 8px var(--accent-glow)' : 'none',
            }}
          >
            {disabled
              ? <Loader2 style={{ width: '15px', height: '15px' }} className="animate-spin" aria-hidden="true" />
              : <ArrowUp style={{ width: '15px', height: '15px' }} strokeWidth={2.5} aria-hidden="true" />}
          </button>
        </div>
        {/* Hint bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px 10px',
            fontSize: 'var(--t-xs)',
            color: 'var(--fg-subtle)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{
                padding: '1px 5px',
                borderRadius: 'var(--r-xs)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75em',
              }}>↵</kbd>
              <span>send</span>
            </span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{
                padding: '1px 5px',
                borderRadius: 'var(--r-xs)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75em',
              }}>⇧↵</kbd>
              <span>new line</span>
            </span>
          </span>
          {value.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)' }}>
              {value.length}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════════════════════════════════════
function SidebarContent({
  documents, selectedId, onSelect, onDelete, onUpload, uploading, uploadError, onDismissMobile,
}: {
  documents: Document[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  uploadError: string | null;
  onDismissMobile?: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const fi = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.type === 'application/pdf') onUpload(f);
  };

  const handleSelect = (id: string | null) => {
    onSelect(id);
    onDismissMobile?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand header */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--r-md)',
              background: 'var(--accent-soft)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <Logo className="w-4 h-4" />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: 'var(--t-base)', color: 'var(--fg)', letterSpacing: '-0.01em' }}>
              DocChat
            </div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-subtle)', marginTop: '1px' }}>
              PDF Intelligence
            </div>
          </div>
        </div>

        {/* Upload zone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            border: `1.5px dashed ${drag ? 'var(--accent)' : 'var(--border-strong)'}`,
            background: drag ? 'var(--accent-soft)' : 'var(--bg-subtle)',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
            transition: 'border-color var(--t-fast), background var(--t-fast)',
            color: drag ? 'var(--accent)' : 'var(--fg-muted)',
            fontSize: 'var(--t-sm)',
            fontWeight: '500',
            pointerEvents: uploading ? 'none' : 'auto',
          }}
        >
          <input
            ref={fi}
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f?.type === 'application/pdf') onUpload(f);
              e.target.value = '';
            }}
            style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}
          />
          {uploading
            ? <Loader2 style={{ width: '14px', height: '14px' }} className="animate-spin" aria-hidden="true" />
            : <Plus style={{ width: '14px', height: '14px' }} strokeWidth={2.5} aria-hidden="true" />}
          <span>
            {uploading ? 'Processing…' : drag ? 'Drop PDF here' : 'Upload PDF'}
          </span>
        </label>

        {uploadError && (
          <p style={{ marginTop: '8px', fontSize: 'var(--t-xs)', color: 'var(--danger)', lineHeight: '1.45' }}>
            {uploadError}
          </p>
        )}
      </div>

      {/* Document list */}
      <nav
        style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}
        aria-label="Documents"
      >
        {documents.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: 'var(--fg-subtle)',
              }}
              aria-hidden="true"
            >
              <FileText style={{ width: '16px', height: '16px' }} />
            </div>
            <p style={{ fontSize: 'var(--t-sm)', fontWeight: '500', color: 'var(--fg-muted)' }}>No documents yet</p>
            <p style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-subtle)', marginTop: '4px', lineHeight: '1.5' }}>
              Upload a PDF to start querying its contents.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* All documents */}
            <button
              type="button"
              id="doc-all"
              onClick={() => handleSelect(null)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: 'var(--r-md)',
                fontSize: 'var(--t-sm)',
                fontWeight: selectedId === null ? '600' : '400',
                color: selectedId === null ? 'var(--fg)' : 'var(--fg-muted)',
                background: selectedId === null ? 'var(--bg-elevated)' : 'none',
                textAlign: 'left',
                transition: 'background var(--t-fast), color var(--t-fast)',
              }}
              onMouseOver={(e) => {
                if (selectedId !== null) {
                  e.currentTarget.style.background = 'var(--bg-subtle)';
                  e.currentTarget.style.color = 'var(--fg)';
                }
              }}
              onMouseOut={(e) => {
                if (selectedId !== null) {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--fg-muted)';
                }
              }}
            >
              <MessageSquarePlus
                style={{
                  width: '14px',
                  height: '14px',
                  flexShrink: 0,
                  color: selectedId === null ? 'var(--accent)' : 'inherit',
                }}
                aria-hidden="true"
              />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                All documents
              </span>
              <span
                style={{
                  fontSize: 'var(--t-xs)',
                  color: 'var(--fg-subtle)',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--bg-subtle)',
                  padding: '2px 6px',
                  borderRadius: 'var(--r-full)',
                  border: '1px solid var(--border)',
                }}
              >
                {documents.length}
              </span>
            </button>

            {/* Section label */}
            <div
              style={{
                padding: '14px 10px 6px',
                fontSize: 'var(--t-xs)',
                fontWeight: '600',
                color: 'var(--fg-subtle)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Library
            </div>

            {/* Individual docs */}
            {documents.map((doc) => {
              const active = selectedId === doc.document_id;
              const isPending = pendingDelete === doc.document_id;
              return (
                <div
                  key={doc.document_id}
                  style={{ position: 'relative' }}
                  className="group"
                >
                  {isPending ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        borderRadius: 'var(--r-md)',
                        background: 'var(--danger-soft)',
                        border: '1px solid var(--danger-border)',
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 'var(--t-sm)',
                          color: 'var(--fg)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Delete?
                      </span>
                      <button
                        type="button"
                        onClick={() => { onDelete(doc.document_id); setPendingDelete(null); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--r-sm)',
                          background: 'var(--danger)',
                          color: 'var(--danger-fg)',
                          fontSize: 'var(--t-xs)',
                          fontWeight: '600',
                        }}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--r-sm)',
                          fontSize: 'var(--t-xs)',
                          color: 'var(--fg-muted)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      id={`doc-${doc.document_id}`}
                      onClick={() => handleSelect(active ? null : doc.document_id)}
                      aria-pressed={active}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 10px',
                        borderRadius: 'var(--r-md)',
                        fontSize: 'var(--t-sm)',
                        fontWeight: active ? '500' : '400',
                        color: active ? 'var(--fg)' : 'var(--fg-muted)',
                        background: active ? 'var(--bg-elevated)' : 'none',
                        textAlign: 'left',
                        transition: 'background var(--t-fast), color var(--t-fast)',
                        position: 'relative',
                      }}
                      onMouseOver={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = 'var(--bg-subtle)';
                          e.currentTarget.style.color = 'var(--fg)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = 'none';
                          e.currentTarget.style.color = 'var(--fg-muted)';
                        }
                      }}
                    >
                      {/* Active indicator */}
                      {active && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '3px',
                            height: '16px',
                            borderRadius: '0 2px 2px 0',
                            background: 'var(--accent)',
                          }}
                        />
                      )}
                      <FileText
                        style={{
                          width: '13px',
                          height: '13px',
                          flexShrink: 0,
                          color: active ? 'var(--accent)' : 'inherit',
                        }}
                        aria-hidden="true"
                      />
                      <span
                        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={doc.filename}
                      >
                        {doc.filename}
                      </span>
                      {/* Delete button — revealed on hover */}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setPendingDelete(doc.document_id); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault(); e.stopPropagation();
                            setPendingDelete(doc.document_id);
                          }
                        }}
                        aria-label={`Delete ${doc.filename}`}
                        style={{
                          padding: '3px',
                          borderRadius: 'var(--r-sm)',
                          color: 'var(--fg-subtle)',
                          transition: 'opacity var(--t-fast), color var(--t-fast)',
                          marginRight: '-3px',
                        }}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        onMouseOver={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.color = 'var(--fg-subtle)'; }}
                      >
                        <Trash2 style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: 'var(--t-xs)',
          color: 'var(--fg-subtle)',
          lineHeight: '1.55',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Zap style={{ width: '11px', height: '11px', flexShrink: 0, color: 'var(--accent)' }} aria-hidden="true" />
        <span>Embeddings via OpenAI · LLM via Groq</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  EMPTY STATE
// ════════════════════════════════════════════════════════════════════════════
function EmptyState({
  hasDocs, onPrompt, selectedLabel,
}: {
  hasDocs: boolean;
  onPrompt: (p: string) => void;
  selectedLabel: string | null;
}) {
  const prompts = useMemo(() => {
    if (!hasDocs) return null;
    return selectedLabel
      ? [
          `Summarize ${selectedLabel}`,
          'What are the main conclusions?',
          'List the key terms and their definitions.',
          'What evidence supports the central claim?',
        ]
      : [
          'Summarize the uploaded documents',
          'What do these documents have in common?',
          'Flag any contradictions across the sources.',
          'What are the most important findings?',
        ];
  }, [hasDocs, selectedLabel]);

  return (
    <div
      className="animate-fade-up"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '32px 16px',
      }}
    >
      {/* Animated logo mark */}
      <div
        style={{
          position: 'relative',
          width: '64px',
          height: '64px',
          marginBottom: '28px',
        }}
        aria-hidden="true"
      >
        {/* Glow ring */}
        <div
          style={{
            position: 'absolute',
            inset: '-8px',
            borderRadius: 'var(--r-xl)',
            background: 'radial-gradient(ellipse at center, var(--accent-glow) 0%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--r-xl)',
            background: 'var(--accent-soft)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            position: 'relative',
          }}
        >
          <Logo className="w-7 h-7" animated={true} />
        </div>
      </div>

      <h2
        style={{
          fontSize: 'var(--t-xl)',
          fontWeight: '700',
          letterSpacing: '-0.02em',
          color: 'var(--fg)',
          marginBottom: '8px',
          textWrap: 'balance',
        }}
      >
        {hasDocs ? 'Ask something specific.' : 'Start by uploading a PDF.'}
      </h2>

      <p
        style={{
          fontSize: 'var(--t-sm)',
          color: 'var(--fg-muted)',
          maxWidth: '36ch',
          lineHeight: '1.65',
          textWrap: 'pretty',
        }}
      >
        {hasDocs
          ? selectedLabel
            ? <>I'll pull answers from <strong style={{ color: 'var(--fg)', fontWeight: '600' }}>{selectedLabel}</strong> and cite the source pages.</>
            : <>I'll search across every uploaded document and cite the pages I drew from.</>
          : <>Drop a PDF in the sidebar. I'll read it, chunk it, embed it, and answer with citations.</>}
      </p>

      {/* Feature pills — shown when no docs */}
      {!hasDocs && (
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'center',
          }}
        >
          {[
            { icon: <FileText style={{ width: '12px', height: '12px' }} />, label: 'Multi-PDF support' },
            { icon: <Link2 style={{ width: '12px', height: '12px' }} />, label: 'Source citations' },
            { icon: <Sparkles style={{ width: '12px', height: '12px' }} />, label: 'Streaming answers' },
          ].map(({ icon, label }) => (
            <span
              key={label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: 'var(--r-full)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: 'var(--t-xs)',
                color: 'var(--fg-muted)',
              }}
            >
              <span style={{ color: 'var(--accent)' }}>{icon}</span>
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Prompt suggestions */}
      {prompts && (
        <div
          style={{
            marginTop: '32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '8px',
            width: '100%',
            maxWidth: '540px',
          }}
        >
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              id={`prompt-${p.slice(0, 20).replace(/\s/g, '-')}`}
              onClick={() => onPrompt(p)}
              style={{
                textAlign: 'left',
                padding: '10px 14px',
                fontSize: 'var(--t-sm)',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--fg-muted)',
                lineHeight: '1.45',
                transition: 'border-color var(--t-fast), background var(--t-fast), color var(--t-fast)',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-focus)';
                e.currentTarget.style.background = 'var(--bg-subtle)';
                e.currentTarget.style.color = 'var(--fg)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.color = 'var(--fg-muted)';
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ERROR BANNER
// ════════════════════════════════════════════════════════════════════════════
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="animate-fade-up"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
        background: 'var(--danger-soft)',
        border: '1px solid var(--danger-border)',
        fontSize: 'var(--t-sm)',
        color: 'var(--danger)',
        maxWidth: 'var(--composer-max)',
      }}
    >
      <AlertCircle style={{ width: '15px', height: '15px', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
      <span style={{ flex: 1, lineHeight: '1.45' }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        style={{ padding: '2px', borderRadius: 'var(--r-sm)', flexShrink: 0 }}
      >
        <X style={{ width: '13px', height: '13px' }} aria-hidden="true" />
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [docsLoaded, setDocsLoaded] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLParagraphElement>(null);
  const liveId = useId();

  const selectedDoc = docs.find((d) => d.document_id === selectedId) ?? null;
  const selectedLabel = selectedDoc?.filename ?? null;

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  // Auto-scroll
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load documents
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/documents`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const text = await r.text();
        try { return JSON.parse(text); } catch { throw new Error(); }
      })
      .then((d) => { if (!cancelled) { setDocs(d.documents || []); setDocsLoaded(true); } })
      .catch(() => { if (!cancelled) setDocsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const refreshDocs = async () => {
    try {
      const r = await fetch(`${API_URL}/documents`);
      if (!r.ok) return;
      const text = await r.text();
      try { const d = JSON.parse(text); setDocs(d.documents || []); } catch { /* non-JSON */ }
    } catch { /* swallow */ }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API_URL}/documents/upload`, { method: 'POST', body: fd });
      const text = await r.text();
      let d: any = {};
      try { d = JSON.parse(text); } catch { /* non-JSON response */ }
      if (!r.ok) throw new Error(d.detail || d.error || 'Upload failed. Is the backend running on port 8000?');
      await refreshDocs();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const r = await fetch(`${API_URL}/documents/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      if (selectedId === id) setSelectedId(null);
      await refreshDocs();
    } catch {
      setError('Could not delete that document. Try again.');
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: Message = { role: 'user', content: q, id: `u-${Date.now()}` };
    const assistantId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: 'assistant', content: '', id: assistantId },
    ]);
    if (liveRegionRef.current) liveRegionRef.current.textContent = 'Assistant is responding.';

    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

    setInput('');
    setLoading(true);
    setError(null);

    try {
      const r = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, document_id: selectedId, stream: true, history }),
      });

      if (!r.ok) {
        let d: any = {};
        try { const t = await r.text(); d = JSON.parse(t); } catch { /* non-JSON */ }
        throw new Error(d.detail || d.error || 'Request failed. Is the backend running on port 8000?');
      }
      if (!r.body) throw new Error('No response stream from the backend.');

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
      let sources: Source[] | undefined;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;

          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed && typeof parsed === 'object') {
                if (typeof parsed.content === 'string') content += parsed.content;
                if (Array.isArray(parsed.sources)) sources = parsed.sources;
                if (parsed.error) throw new Error(parsed.error);
              } else {
                content += data;
              }
            } catch {
              content += data;
            }

            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content, sources } : m),
            );
          }
        }
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
      if (liveRegionRef.current) liveRegionRef.current.textContent = '';
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setError(null);
    setInput('');
  };

  // ── Header title ─────────────────────────────────────────────────────
  const headerTitle = selectedDoc
    ? { icon: <FileText style={{ width: '13px', height: '13px', color: 'var(--accent)' }} aria-hidden="true" />, text: selectedDoc.filename }
    : docs.length > 0
      ? { icon: <MessageSquarePlus style={{ width: '13px', height: '13px', color: 'var(--fg-subtle)' }} aria-hidden="true" />, text: 'All documents' }
      : { icon: null, text: 'New conversation' };

  return (
    <div
      style={{
        display: 'flex',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--bg)',
        color: 'var(--fg)',
      }}
    >
      {/* Live region */}
      <p
        id={liveId}
        ref={liveRegionRef}
        style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}
        aria-live="polite"
        aria-atomic="false"
      />

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside
        className="hidden md:flex"
        style={{
          flexShrink: 0,
          width: 'var(--sidebar-w)',
          background: 'var(--surface-2)',
          borderRight: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sidebar)',
          zIndex: 'var(--z-sidebar)',
        }}
        aria-label="Documents"
      >
        <div style={{ width: '100%' }}>
          <SidebarContent
            documents={docs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
            onUpload={handleUpload}
            uploading={uploading}
            uploadError={uploadError}
          />
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>

        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '0 16px',
            height: 'var(--header-h)',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {/* Mobile menu toggle */}
            <button
              type="button"
              id="sidebar-toggle"
              onClick={() => setMobileOpen(true)}
              className="flex md:hidden"
              style={{
                padding: '6px',
                marginLeft: '-4px',
                borderRadius: 'var(--r-sm)',
                color: 'var(--fg-muted)',
                alignItems: 'center',
              }}
              aria-label="Open documents"
            >
              <Menu style={{ width: '16px', height: '16px' }} aria-hidden="true" />
            </button>

            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              {headerTitle.icon}
              <h1
                style={{
                  fontSize: 'var(--t-sm)',
                  fontWeight: '500',
                  color: 'var(--fg)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textWrap: 'balance',
                }}
              >
                {headerTitle.text}
              </h1>
            </div>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {messages.length > 0 && (
              <button
                type="button"
                id="new-chat-btn"
                onClick={handleNewChat}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--t-sm)',
                  color: 'var(--fg-muted)',
                  transition: 'background var(--t-fast), color var(--t-fast)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--bg-subtle)';
                  e.currentTarget.style.color = 'var(--fg)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--fg-muted)';
                }}
                title="Start a new chat"
              >
                <MessageSquarePlus style={{ width: '13px', height: '13px' }} aria-hidden="true" />
                <span className="hidden sm:inline">New chat</span>
              </button>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div style={{ padding: '12px 16px 0' }}>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Chat log */}
        <div
          data-scroll-anchor
          style={{ flex: 1, overflowY: 'auto' }}
        >
          <div
            style={{
              margin: '0 auto',
              width: '100%',
              padding: '32px 20px 16px',
              maxWidth: 'var(--message-max)',
            }}
          >
            {messages.length === 0 ? (
              <EmptyState
                hasDocs={docs.length > 0}
                onPrompt={(p) => setInput(p)}
                selectedLabel={selectedLabel}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  const streaming = isLast && m.role === 'assistant' && loading;
                  return (
                    <MessageItem key={m.id} message={m} isStreaming={streaming} />
                  );
                })}
                {loading && messages.at(-1)?.role === 'assistant' && !messages.at(-1)?.content && (
                  <div
                    className="animate-fade-up"
                    style={{ display: 'flex', gap: '12px' }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--r-md)',
                        background: 'var(--accent-soft)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                      }}
                    >
                      <Logo className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 'var(--t-xs)',
                          fontWeight: '600',
                          color: 'var(--fg-subtle)',
                          marginBottom: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Assistant
                      </div>
                      <span className="dot-typing" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span /><span /><span />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={endRef} style={{ height: '1px' }} aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              margin: '0 auto',
              width: '100%',
              padding: '16px 20px',
              maxWidth: 'var(--composer-max)',
            }}
          >
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={handleSend}
              disabled={loading || (docsLoaded && docs.length === 0)}
              placeholder={
                selectedDoc
                  ? `Ask about ${selectedDoc.filename}…`
                  : docs.length > 0
                    ? 'Ask across all documents…'
                    : 'Upload a PDF in the sidebar to begin.'
              }
            />
          </div>
        </div>
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="flex md:hidden"
          style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Documents"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close documents"
            onClick={() => setMobileOpen(false)}
            className="animate-fade-in"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'oklch(0 0 0 / 0.55)',
              backdropFilter: 'blur(4px)',
              cursor: 'pointer',
              border: 'none',
              width: '100%',
              height: '100%',
            }}
          />
          {/* Panel */}
          <div
            className="animate-sheet-in"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: 'var(--sidebar-w)',
              maxWidth: '85vw',
              background: 'var(--surface-2)',
              borderRight: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Mobile header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                height: 'var(--header-h)',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 'var(--t-sm)', fontWeight: '500', color: 'var(--fg-muted)' }}>Documents</span>
              <button
                type="button"
                id="close-sidebar-btn"
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
                style={{
                  padding: '6px',
                  marginRight: '-4px',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--fg-muted)',
                  display: 'flex',
                }}
              >
                <X style={{ width: '15px', height: '15px' }} aria-hidden="true" />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <SidebarContent
                documents={docs}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={handleDelete}
                onUpload={handleUpload}
                uploading={uploading}
                uploadError={uploadError}
                onDismissMobile={() => setMobileOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
