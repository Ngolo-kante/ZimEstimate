'use client';

import { useState } from 'react';
import { ChatCircle, PaperPlaneTilt, MagnifyingGlass } from '@phosphor-icons/react';

type Message = { from: 'me' | 'them'; text: string; time: string };
type Thread = { id: string; name: string; project: string; lastMsg: string; time: string; unread: number; messages: Message[] };

const MOCK_THREADS: Thread[] = [
  {
    id: '1', name: 'Tafadzwa M.', project: 'Harare Residential Build', lastMsg: 'Can you deliver before Friday?', time: '10:32', unread: 2,
    messages: [
      { from: 'them', text: 'Hi, we received your quote for cement. Looks good!', time: '10:15' },
      { from: 'me', text: 'Thanks! Let me know when you want to confirm the order.', time: '10:20' },
      { from: 'them', text: 'Can you deliver before Friday?', time: '10:32' },
    ],
  },
  {
    id: '2', name: 'Sithembile N.', project: 'Bulawayo Office Block', lastMsg: 'We need 20 more Y12 bars.', time: 'Yesterday', unread: 0,
    messages: [
      { from: 'them', text: 'The first batch of rebar arrived. Quality is great.', time: 'Yesterday 14:10' },
      { from: 'me', text: 'Happy to hear that! Let us know if you need more.', time: 'Yesterday 14:30' },
      { from: 'them', text: 'We need 20 more Y12 bars.', time: 'Yesterday 15:00' },
    ],
  },
  {
    id: '3', name: 'Chiedza P.', project: 'Masvingo Townhouse', lastMsg: 'Thanks for the quick turnaround!', time: 'Mon', unread: 0,
    messages: [
      { from: 'them', text: 'Roofing sheets have been installed. Thanks for the quick turnaround!', time: 'Mon 09:00' },
      { from: 'me', text: 'Our pleasure. Feel free to reach out for future projects.', time: 'Mon 09:30' },
    ],
  },
];

export default function SupplierMessagesPage() {
  const [threads, setThreads] = useState(MOCK_THREADS);
  const [activeId, setActiveId] = useState<string | null>('1');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');

  const activeThread = threads.find(t => t.id === activeId);

  const sendMessage = () => {
    if (!input.trim() || !activeId) return;
    setThreads(prev => prev.map(t => t.id === activeId ? {
      ...t,
      messages: [...t.messages, { from: 'me' as const, text: input, time: 'Now' }],
      lastMsg: input,
      unread: 0,
    } : t));
    setInput('');
  };

  const selectThread = (id: string) => {
    setActiveId(id);
    setThreads(prev => prev.map(t => t.id === id ? { ...t, unread: 0 } : t));
  };

  const filtered = threads.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.project.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="messages-shell">
      {/* Thread list */}
      <div className="thread-list">
        <div className="thread-search">
          <MagnifyingGlass size={15} />
          <input className="search-input" placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filtered.map(t => (
          <div key={t.id} className={`thread-item ${activeId === t.id ? 'active' : ''}`} onClick={() => selectThread(t.id)}>
            <div className="thread-avatar">{t.name[0]}</div>
            <div className="thread-info">
              <div className="thread-top">
                <span className="thread-name">{t.name}</span>
                <span className="thread-time">{t.time}</span>
              </div>
              <div className="thread-project">{t.project}</div>
              <div className="thread-preview">{t.lastMsg}</div>
            </div>
            {t.unread > 0 && <span className="unread-badge">{t.unread}</span>}
          </div>
        ))}
      </div>

      {/* Chat pane */}
      {activeThread ? (
        <div className="chat-pane">
          <div className="chat-header">
            <div className="chat-avatar">{activeThread.name[0]}</div>
            <div>
              <div className="chat-name">{activeThread.name}</div>
              <div className="chat-project">{activeThread.project}</div>
            </div>
          </div>
          <div className="chat-messages">
            {activeThread.messages.map((m, i) => (
              <div key={i} className={`message ${m.from === 'me' ? 'outgoing' : 'incoming'}`}>
                <div className="bubble">{m.text}</div>
                <div className="msg-time">{m.time}</div>
              </div>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button className="send-btn" onClick={sendMessage} disabled={!input.trim()}>
              <PaperPlaneTilt size={18} weight="fill" />
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-empty">
          <ChatCircle size={40} />
          <p>Select a conversation</p>
        </div>
      )}

      <style jsx>{`
        .messages-shell { display: flex; height: calc(100vh - 0px); background: #f8fafc; overflow: hidden; }
        .thread-list { width: 300px; min-width: 300px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow-y: auto; }
        .thread-search { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #f1f5f9; color: #94a3b8; }
        .search-input { border: none; outline: none; font-size: 0.8125rem; flex: 1; }
        .thread-item { display: flex; align-items: flex-start; gap: 10px; padding: 14px 16px; cursor: pointer; border-bottom: 1px solid #f1f5f9; position: relative; }
        .thread-item:hover { background: #f8fafc; }
        .thread-item.active { background: #eff6ff; border-right: 2px solid #2563eb; }
        .thread-avatar { width: 38px; height: 38px; background: #eff6ff; color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.875rem; flex-shrink: 0; }
        .thread-info { flex: 1; min-width: 0; }
        .thread-top { display: flex; justify-content: space-between; align-items: center; }
        .thread-name { font-size: 0.875rem; font-weight: 700; color: #0f172a; }
        .thread-time { font-size: 0.7rem; color: #94a3b8; }
        .thread-project { font-size: 0.72rem; color: #64748b; margin: 2px 0; }
        .thread-preview { font-size: 0.8rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .unread-badge { background: #2563eb; color: white; font-size: 0.65rem; font-weight: 700; border-radius: 20px; padding: 2px 7px; flex-shrink: 0; margin-top: 2px; }
        .chat-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .chat-header { display: flex; align-items: center; gap: 12px; padding: 16px 24px; background: white; border-bottom: 1px solid #e2e8f0; }
        .chat-avatar { width: 40px; height: 40px; background: #eff6ff; color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
        .chat-name { font-size: 0.9375rem; font-weight: 700; color: #0f172a; }
        .chat-project { font-size: 0.75rem; color: #64748b; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; }
        .message { display: flex; flex-direction: column; }
        .message.outgoing { align-items: flex-end; }
        .message.incoming { align-items: flex-start; }
        .bubble { max-width: 70%; padding: 10px 14px; border-radius: 16px; font-size: 0.875rem; line-height: 1.45; }
        .outgoing .bubble { background: #2563eb; color: white; border-bottom-right-radius: 4px; }
        .incoming .bubble { background: white; color: #1e293b; border: 1px solid #e2e8f0; border-bottom-left-radius: 4px; }
        .msg-time { font-size: 0.7rem; color: #94a3b8; margin-top: 4px; }
        .chat-input-row { display: flex; align-items: center; gap: 10px; padding: 14px 24px; background: white; border-top: 1px solid #e2e8f0; }
        .chat-input { flex: 1; border: 1px solid #e2e8f0; border-radius: 24px; padding: 10px 18px; font-size: 0.875rem; outline: none; }
        .chat-input:focus { border-color: #93c5fd; }
        .send-btn { width: 40px; height: 40px; background: #2563eb; color: white; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; gap: 12px; }
      `}</style>
    </div>
  );
}
