'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { todayStr } from '@/lib/dates';

interface Thread {
  id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
}

function formatThreadDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function CoachPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load threads on mount
  useEffect(() => {
    apiFetch<{ items: Thread[] }>('/coach/threads')
      .then((res) => {
        const sorted = [...res.items].sort((a, b) => {
          const ta = a.last_message_at ?? a.created_at;
          const tb = b.last_message_at ?? b.created_at;
          return ta < tb ? 1 : -1;
        });
        setThreads(sorted);
        if (sorted.length > 0 && sorted[0]) setSelectedId(sorted[0].id);
      })
      .catch(() => toast.error('Erreur lors du chargement des conversations.'))
      .finally(() => setLoadingThreads(false));
  }, []);

  // Load messages when thread changes
  useEffect(() => {
    if (!selectedId) return;
    setLoadingMessages(true);
    apiFetch<{ items: Message[] }>(`/coach/threads/${selectedId}/messages`)
      .then((res) => setMessages(res.items))
      .catch(() => toast.error('Erreur lors du chargement des messages.'))
      .finally(() => setLoadingMessages(false));
  }, [selectedId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createThread = async () => {
    setCreatingThread(true);
    try {
      const thread = await apiFetch<Thread>('/coach/threads', {
        method: 'POST',
        body: JSON.stringify({ title: `Conversation du ${todayStr()}` }),
      });
      setThreads((prev) => [thread, ...prev]);
      setSelectedId(thread.id);
      setMessages([]);
    } catch {
      toast.error('Erreur lors de la création de la conversation.');
    } finally {
      setCreatingThread(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selectedId) return;

    const tempId = `temp-${Date.now()}`;
    const userMsg: Message = {
      id: tempId,
      role: 'user',
      text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    // Add typing indicator
    const typingId = `typing-${Date.now()}`;
    const typingMsg: Message = {
      id: typingId,
      role: 'assistant',
      text: '…',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, typingMsg]);

    try {
      const res = await apiFetch<{ messages: Message[] }>(`/coach/threads/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });

      // Replace typing indicator with real response
      const assistantMsgs = res.messages.filter((m) => m.role === 'assistant');
      setMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.id !== typingId);
        return assistantMsgs.length > 0
          ? [...withoutTyping, ...assistantMsgs]
          : withoutTyping;
      });

      // Update thread last_message_at
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? { ...t, last_message_at: new Date().toISOString() }
            : t,
        ),
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== typingId));
      toast.error('Erreur lors de l\'envoi du message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] max-w-6xl gap-0 rounded-lg border border-bg-strong overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-60 flex-shrink-0 border-r border-bg-strong bg-bg-subtle flex flex-col">
        <div className="p-3 border-b border-bg-strong">
          <button
            type="button"
            onClick={createThread}
            disabled={creatingThread}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-accent-xp/30 bg-accent-xp/10 text-accent-xp text-xs font-medium py-2 hover:bg-accent-xp/20 transition-colors disabled:opacity-50"
          >
            {creatingThread ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Nouvelle conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="flex items-center justify-center h-20 text-text-muted">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <p className="text-xs text-text-muted text-center p-4">
              Aucune conversation.
            </p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-3 py-3 border-b border-bg-strong/50 transition-colors ${
                  selectedId === t.id
                    ? 'bg-bg-strong text-text-DEFAULT'
                    : 'text-text-muted hover:bg-bg-strong/40 hover:text-text-DEFAULT'
                }`}
              >
                <div className="text-xs font-medium truncate">
                  {t.title ?? '(sans titre)'}
                </div>
                {(t.last_message_at ?? t.created_at) && (
                  <div className="text-xs text-text-muted mt-0.5 truncate">
                    {formatThreadDate(t.last_message_at ?? t.created_at)}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col bg-bg-DEFAULT min-w-0">
        {selectedId === null ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            Sélectionne ou crée une conversation.
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-text-muted">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  Aucun message. Commence la conversation !
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-accent-xp/20 border border-accent-xp/40 text-text-DEFAULT rounded-br-sm'
                          : 'bg-bg-subtle border border-bg-strong text-text-DEFAULT rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-bg-strong p-3 flex gap-2 items-end bg-bg-subtle">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Écris un message… (Entrée pour envoyer)"
                rows={2}
                className="flex-1 resize-none rounded-lg bg-bg-strong border border-bg-strong focus:border-accent-xp/50 outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-accent-xp text-bg-DEFAULT hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
