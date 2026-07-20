import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { FileText, Copy, Download, MessageSquare, BarChart3, ArrowLeft, RefreshCw, Check, Sparkles } from 'lucide-react';

export const AISummary: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [docName, setDocName] = useState('');
  const [activeTab, setActiveTab] = useState<'executive' | 'detailed' | 'bullet'>('executive');
  
  // Summary contents
  const [executive, setExecutive] = useState('');
  const [detailed, setDetailed] = useState('');
  const [bullet, setBullet] = useState('');

  // Streaming status
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);

  // Toast status
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    // Fetch document details
    const fetchDocInfo = async () => {
      try {
        const response = await axios.get(`/api/documents/${id}`);
        setDocName(response.data.filename);
        
        // Load pre-existing summaries if any
        if (response.data.summary_executive) setExecutive(response.data.summary_executive);
        if (response.data.summary_detailed) setDetailed(response.data.summary_detailed);
        if (response.data.summary_bullet) setBullet(response.data.summary_bullet);
      } catch (err: any) {
        console.error(err);
        setToastMessage('Failed to load document info.');
        setToastType('error');
        setToastVisible(true);
      }
    };

    if (id) {
      fetchDocInfo();
    }
  }, [id]);

  const triggerStream = async (type: 'executive' | 'detailed' | 'bullet') => {
    setStreaming(true);
    const setter = type === 'executive' ? setExecutive : type === 'detailed' ? setDetailed : setBullet;
    setter('');

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };
      const userKey = sessionStorage.getItem('user_openai_key');
      if (userKey) {
        headers['X-OpenAI-Key'] = userKey;
      }

      const response = await fetch(`/api/documents/${id}/stream-summary?type=${type}`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to start summary generation stream');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) return;

      let resultText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        // Clean out SSE formatting prefixes if any (e.g. data: text)
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const cleanText = line.substring(6);
            if (cleanText === '[DONE]') {
              break;
            }
            resultText += cleanText;
            setter(resultText);
          } else if (line.trim() !== '') {
            // fallback for raw streams
            resultText += line;
            setter(resultText);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setToastMessage('Failed to stream summary from LLM.');
      setToastType('error');
      setToastVisible(true);
    } finally {
      setStreaming(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = activeTab === 'executive' ? executive : activeTab === 'detailed' ? detailed : bullet;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setToastMessage('Copied to clipboard!');
    setToastType('success');
    setToastVisible(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format: 'pdf' | 'docx' | 'txt') => {
    setToastMessage(`Preparing download as ${format.toUpperCase()}...`);
    setToastType('info');
    setToastVisible(true);
    
    // Download directly using window.open or a custom tag with bearer headers
    // Since browser downloads don't support custom headers, the backend endpoint 
    // accepts token in query params, or we do a blob fetch. Let's do a blob fetch to be completely secure!
    axios({
      url: `/api/documents/${id}/export?format=${format}&type=${activeTab}`,
      method: 'GET',
      responseType: 'blob'
    })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `DocMind_Summary_${id}.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setToastMessage('Download started!');
        setToastType('success');
        setToastVisible(true);
      })
      .catch((err) => {
        console.error(err);
        setToastMessage('Failed to download report.');
        setToastType('error');
        setToastVisible(true);
      });
  };

  const getActiveText = () => {
    if (activeTab === 'executive') return executive;
    if (activeTab === 'detailed') return detailed;
    return bullet;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 relative">
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />

      {/* Header Back & Nav tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        
        {/* Navigation tabs for current doc */}
        <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
          <Link to={`/summary/${id}`} className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            AI Summary
          </Link>
          <Link to={`/analysis/${id}`} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Analysis
          </Link>
          <Link to={`/chat/${id}`} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            AI Chat
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight truncate max-w-3xl font-['Outfit']">
          {docName || 'Loading Document Summary...'}
        </h1>
        <p className="text-slate-400 text-xs mt-1">Review the generated AI outputs below. Re-generate at any time.</p>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Toggles sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <div className="p-4 rounded-2xl glass-panel space-y-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3 pl-1">Summary Types</span>
            <button
              onClick={() => setActiveTab('executive')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'executive'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              Executive Summary
            </button>
            <button
              onClick={() => setActiveTab('detailed')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'detailed'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              Detailed Summary
            </button>
            <button
              onClick={() => setActiveTab('bullet')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'bullet'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              Bullet Summary
            </button>
          </div>

          <button
            onClick={() => triggerStream(activeTab)}
            disabled={streaming}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${streaming ? 'animate-spin' : ''}`} />
            {streaming ? 'Generating...' : 'Re-generate Summary'}
          </button>
        </div>

        {/* Right Output pane */}
        <div className="lg:col-span-3 p-6 rounded-2xl glass-panel flex flex-col justify-between min-h-[500px]">
          <div>
            {/* Action Bar */}
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-white/5">
              <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {activeTab.toUpperCase()} OUTPUT
              </span>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  disabled={!getActiveText()}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Copy to Clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <div className="h-4 w-px bg-white/5 mx-1"></div>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={!getActiveText()}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold flex items-center gap-1"
                  title="Export as PDF"
                >
                  <Download className="w-4 h-4" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => handleExport('docx')}
                  disabled={!getActiveText()}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold flex items-center gap-1"
                  title="Export as DOCX"
                >
                  <Download className="w-4 h-4" />
                  <span>DOCX</span>
                </button>
                <button
                  onClick={() => handleExport('txt')}
                  disabled={!getActiveText()}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold flex items-center gap-1"
                  title="Export as TXT"
                >
                  <Download className="w-4 h-4" />
                  <span>TXT</span>
                </button>
              </div>
            </div>

            {/* Content view */}
            <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-300">
              {getActiveText() ? (
                <ReactMarkdown>{getActiveText()}</ReactMarkdown>
              ) : streaming ? (
                <div className="flex items-center gap-2 text-slate-500 py-6">
                  <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                  <span>Streaming summary tokens progressively...</span>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="font-semibold text-sm">No summary generated yet.</p>
                  <button
                    onClick={() => triggerStream(activeTab)}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 mt-2 hover:underline"
                  >
                    Click to generate {activeTab} summary
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 text-right">
            <span className="text-[10px] text-slate-500">Powered by OpenAI GPT Models</span>
          </div>
        </div>
      </div>
    </div>
  );
};
