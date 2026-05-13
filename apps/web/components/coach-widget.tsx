'use client';
import { useEffect, useRef, useState } from 'react';
import { Bot, X, Send, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { motion, AnimatePresence } from 'framer-motion';

interface Message { id?: string; role: 'user' | 'assistant'; content: string; }
interface Thread { id: string; title?: string; }

export function CoachWidget() {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lazy-init: create or reuse thread only when opened first time
  useEffect(() => {
    if (!open || thread) return;
    setLoading(true);
    (async () => {
      try {
        const list = await apiFetch<{ threads?: Thread[] } | Thread[]>('/coach/threads');
        const threads = Array.isArray(list) ? list : ((list as { threads?: Thread[] }).threads ?? []);
        let t: Thread;
        if (threads.length > 0) {
          t = threads[0]!;
          const msgs = await apiFetch<{ messages?: Message[] } | Message[]>(`/coach/threads/${t.id}/messages`);
          const arr = Array.isArray(msgs) ? msgs : ((msgs as { messages?: Message[] }).messages ?? []);
          setMessages(arr.map((m) => ({ role: m.role, content: m.content })));
        } else {
          const created = await apiFetch<Thread>('/coach/threads', {
            method: 'POST',
            body: JSON.stringify({ title: 'Coach widget' }),
          });
          t = created;
        }
        setThread(t);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[coach-widget] init failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, thread]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    if (!input.trim() || !thread || sending) return;
    const text = input;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setSending(true);
    try {
      const res = await apiFetch<Record<string, unknown>>(
        `/coach/threads/${thread.id}/messages`,
        { method: 'POST', body: JSON.stringify({ text }) },
      );
      const assistantText =
        (res as { message?: { content?: string } }).message?.content ??
        (res as { content?: string }).content ??
        (typeof res === 'string' ? res : 'OK');
      setMessages((m) => [...m, { role: 'assistant', content: String(assistantText) }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Erreur : ${e instanceof Error ? e.message : 'inconnue'}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent-spirit text-bg-DEFAULT shadow-lg shadow-accent-spirit/30 flex items-center justify-center hover:scale-105 transition-transform"
        title="Coach IA"
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] rounded-lg border border-bg-strong bg-bg-DEFAULT shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-bg-strong">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-accent-spirit" />
                <span className="font-display tracking-wider text-sm">COACH IA</span>
              </div>
              <span className="text-xs text-text-muted">Accès à tes données</span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && (
                <div className="text-text-muted text-xs flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Chargement…
                </div>
              )}
              {!loading && messages.length === 0 && (
                <div className="text-text-muted text-xs">
                  Pose ta question. Le coach peut lire ton sommeil, séances, mesures, photos, etc.
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm whitespace-pre-wrap rounded-lg p-3 ${
                    m.role === 'user'
                      ? 'ml-auto max-w-[85%] bg-accent-xp/15 border border-accent-xp/30 text-text-DEFAULT'
                      : 'mr-auto max-w-[85%] bg-bg-subtle border border-bg-strong'
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {sending && (
                <div className="mr-auto max-w-[85%] bg-bg-subtle border border-bg-strong rounded-lg p-3 text-sm text-text-muted">
                  <Loader2 size={12} className="animate-spin inline mr-2" />
                  Réflexion…
                </div>
              )}
            </div>

            <div className="border-t border-bg-strong p-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Demande au coach…"
                disabled={!thread || sending}
                className="flex-1 rounded border border-bg-strong bg-bg-subtle text-sm px-3 py-2 focus:outline-none focus:border-accent-spirit disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={!input.trim() || !thread || sending}
                className="rounded bg-accent-spirit text-bg-DEFAULT px-3 py-2 disabled:opacity-50 hover:opacity-90"
              >
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
