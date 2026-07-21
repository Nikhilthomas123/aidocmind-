import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, ArrowLeft, Search, FileText, BarChart3, HelpCircle, Loader2, Sparkles, User, Brain } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SearchResult {
  text: string;
  page: number;
}

export const AIChat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const [docName, setDocName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');

  // Search variables
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Toast status
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [toastVisible, setToastVisible] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDocInfoAndHistory = async () => {
      try {
        const docRes = await axios.get(`/api/documents/${id}`);
        setDocName(docRes.data.filename);

        const historyRes = await axios.get(`/api/chat/history/${id}`);
        if (Array.isArray(historyRes.data) && historyRes.data.length > 0) {
          setMessages(historyRes.data);
        }
      } catch (err: any) {
        console.error(err);
        setToastMessage('Failed to load document or history info.');
        setToastType('error');
        setToastVisible(true);
      }
    };

    if (id) {
      fetchDocInfoAndHistory();
    }
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToSend?: string) => {
    const messageContent = textToSend || inputMessage;
    if (!messageContent.trim()) return;

    if (!textToSend) {
      setInputMessage('');
    }

    const newUserMessage: Message = { role: 'user', content: messageContent };
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);
    setStreamingMessage('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      const userKey = sessionStorage.getItem('user_openai_key');
      if (userKey) {
        headers['X-OpenAI-Key'] = userKey;
      }

      const response = await fetch(`/api/chat/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          document_id: Number(id),
          query: messageContent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send chat query');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) return;

      let resultText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const cleanText = line.substring(6);
              if (cleanText === '[DONE]') break;
              resultText += cleanText;
              setStreamingMessage(resultText);
            }
          }
        }
      }

      if (buffer.trim().startsWith('data: ')) {
        const cleanText = buffer.trim().substring(6);
        if (cleanText !== '[DONE]') {
          resultText += cleanText;
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: resultText }]);
      setStreamingMessage('');
    } catch (err: any) {
      console.error(err);
      setToastMessage('Failed to get answer from AI.');
      setToastType('error');
      setToastVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const response = await axios.get(`/api/documents/${id}/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
      if (response.data.length === 0) {
        setToastMessage('No matches found in the document.');
        setToastType('info');
        setToastVisible(true);
      }
    } catch (err: any) {
      console.error(err);
      setToastMessage('Search failed.');
      setToastType('error');
      setToastVisible(true);
    } finally {
      setSearching(false);
    }
  };

  const highlightMatches = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-400/30 text-amber-300 font-bold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const sampleQuestions = [
    "What is this document about?",
    "Summarize this document.",
    "List all deadlines & dates.",
    "List action items.",
    "What are the risks or issues?",
    "What is the conclusion?"
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 relative">
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />

      {/* Header back & navigation tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        
        {/* Navigation tabs */}
        <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
          <Link to={`/summary/${id}`} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            AI Summary
          </Link>
          <Link to={`/analysis/${id}`} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Analysis
          </Link>
          <Link to={`/chat/${id}`} className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            AI Chat
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight truncate max-w-3xl font-['Outfit']">
          {docName || 'Loading Chat Sandbox...'}
        </h1>
        <p className="text-slate-400 text-xs mt-1">Converse with your document or perform term searches inside the text.</p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Side panels: Search & Samples */}
        <div className="lg:col-span-1 space-y-6">
          {/* Document Search Panel */}
          <div className="p-4 rounded-2xl glass-panel">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3 pl-1">Search inside Document</span>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <div className="relative flex-grow">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="search term..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#080b11] border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="p-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-all disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </form>

            {/* Search results list */}
            <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 scrollbar">
              {searchResults.map((res, i) => (
                <div key={i} className="p-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-300 leading-normal">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">
                    <span>Page {res.page}</span>
                  </div>
                  <p>{highlightMatches(res.text, searchQuery)}</p>
                </div>
              ))}
              {searchResults.length === 0 && !searching && (
                <span className="text-slate-500 text-[10px] italic text-center block py-4">No query search results.</span>
              )}
            </div>
          </div>

          {/* Quick Prompts Panel */}
          <div className="p-4 rounded-2xl glass-panel">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3 pl-1">Suggested Questions</span>
            <div className="space-y-2">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  disabled={loading}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 text-xs text-slate-300 hover:text-indigo-300 transition-all font-medium"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Chat Panel */}
        <div className="lg:col-span-3 h-[600px] rounded-2xl glass-panel flex flex-col justify-between overflow-hidden relative">
          
          {/* Chat Messages Log */}
          <div className="flex-grow p-6 overflow-y-auto space-y-4 scrollbar">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 flex items-center justify-center mb-4">
                  <Brain className="w-6 h-6" />
                </div>
                <p className="text-slate-300 text-sm font-bold">DocMind Chat Sandbox</p>
                <p className="text-slate-500 text-xs mt-1.5 max-w-sm">Ask any question. The AI will audit document context vectors to provide sourced responses.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 text-sm max-w-[85%] ${
                  msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs border ${
                  msg.role === 'user'
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/25'
                    : 'bg-violet-500/20 text-violet-400 border-violet-500/25'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className={`p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-indigo-500/10 text-slate-100 border border-indigo-500/10 rounded-tr-none'
                    : 'bg-white/5 text-slate-300 border border-white/5 rounded-tl-none'
                }`}>
                  <ReactMarkdown className="prose prose-invert max-w-none prose-sm leading-relaxed">{msg.content}</ReactMarkdown>
                </div>
              </motion.div>
            ))}

            {/* Streaming message chunk */}
            {streamingMessage && (
              <div className="flex gap-3 text-sm max-w-[85%]">
                <div className="h-8 w-8 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/25 flex items-center justify-center flex-shrink-0 text-xs">
                  <Brain className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-white/5 text-slate-300 border border-white/5 rounded-tl-none">
                  <ReactMarkdown className="prose prose-invert max-w-none prose-sm leading-relaxed">{streamingMessage}</ReactMarkdown>
                </div>
              </div>
            )}

            {loading && !streamingMessage && (
              <div className="flex gap-3 text-sm max-w-[85%]">
                <div className="h-8 w-8 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/25 flex items-center justify-center flex-shrink-0 text-xs">
                  <Brain className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-white/5 text-slate-500 border border-white/5 rounded-tl-none flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Searching document chunks...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input text form */}
          <div className="p-4 border-t border-white/5 bg-[#0b0f19]/80 backdrop-blur-sm">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about this document..."
                disabled={loading}
                className="flex-grow px-4 py-3 rounded-xl bg-[#080b11] border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !inputMessage.trim()}
                className="px-4 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-all flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/10 hover:scale-[1.02]"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
