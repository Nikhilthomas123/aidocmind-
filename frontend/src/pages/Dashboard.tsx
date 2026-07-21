import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import { motion } from 'framer-motion';
import { Upload, FileText, MessageSquare, BarChart3, Clock, Star, Trash2, ArrowRight, Brain, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface Document {
  id: number;
  filename: string;
  file_size: number;
  created_at: string;
  is_favorite: boolean;
  summary_generated: boolean;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  // Toast status
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [toastVisible, setToastVisible] = useState(false);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('/api/documents');
      setDocuments(response.data);
    } catch (err: any) {
      console.error('Fetch documents error:', err);
      const detail = err.response?.data?.detail;
      setToastMessage(detail ? `Failed to fetch documents: ${detail}` : 'Failed to fetch documents. Backend server may be offline.');
      setToastType('error');
      setToastVisible(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const toggleFavorite = async (docId: number, currentStatus: boolean) => {
    try {
      await axios.put(`/api/documents/${docId}/favorite`, {
        is_favorite: !currentStatus
      });
      setDocuments(docs =>
        docs.map(doc => (doc.id === docId ? { ...doc, is_favorite: !currentStatus } : doc))
      );
      setToastMessage(!currentStatus ? 'Added to favorites' : 'Removed from favorites');
      setToastType('success');
      setToastVisible(true);
    } catch (err: any) {
      setToastMessage('Failed to update favorite status.');
      setToastType('error');
      setToastVisible(true);
    }
  };

  const deleteDocument = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document? All associated summaries, vector embeddings, and chat history will be deleted.')) {
      return;
    }

    try {
      await axios.delete(`/api/documents/${docId}`);
      setDocuments(docs => docs.filter(doc => doc.id !== docId));
      setToastMessage('Document deleted successfully.');
      setToastType('success');
      setToastVisible(true);
    } catch (err: any) {
      setToastMessage('Failed to delete document.');
      setToastType('error');
      setToastVisible(true);
    }
  };

  const getFormatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const recentDocs = documents.slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 relative">
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />

      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight font-['Outfit'] flex items-center gap-2">
            Welcome back, <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">{user?.full_name || user?.username}</span> 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">Configure your documents, review analyses, and chat with AI in real-time.</p>
        </div>
        <Link
          to="/upload"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:opacity-95 font-semibold text-sm shadow-lg shadow-indigo-500/15 hover:scale-[1.01] transition-all"
        >
          <Upload className="w-4 h-4" />
          Upload New Document
        </Link>
      </div>

      {/* Main Core Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Upload Card */}
        <Link to="/upload" className="p-6 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between h-[180px]">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10">
              <Upload className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200 font-['Outfit']">Upload File</h3>
            <p className="text-xs text-slate-400 mt-1">Upload PDF, DOCX, or TXT documents up to 20MB.</p>
          </div>
        </Link>

        {/* AI Summary Card */}
        <Link to="/history" className="p-6 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between h-[180px]">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/10">
              <FileText className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200 font-['Outfit']">AI Summary</h3>
            <p className="text-xs text-slate-400 mt-1">Generate dynamic Executive, Detailed, & Bullet reports.</p>
          </div>
        </Link>

        {/* Document Analysis Card */}
        <Link to="/history" className="p-6 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between h-[180px]">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/10">
              <BarChart3 className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200 font-['Outfit']">Document Analysis</h3>
            <p className="text-xs text-slate-400 mt-1">Audit sentiment, tone, keywords, glossary, and key takeaways.</p>
          </div>
        </Link>

        {/* AI Chat Card */}
        <Link to="/history" className="p-6 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between h-[180px]">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/10">
              <MessageSquare className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200 font-['Outfit']">AI Chat</h3>
            <p className="text-xs text-slate-400 mt-1">Interact with documents securely. Sourced facts only.</p>
          </div>
        </Link>
      </div>

      {/* Recent Files Table & History Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold tracking-tight text-slate-200 font-['Outfit'] flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                Recent Documents
              </h2>
              <Link to="/history" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                View all logs
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4 py-6">
                {[1, 2, 3].map(n => (
                  <div key={n} className="h-12 bg-white/5 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : recentDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 mb-4">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-slate-400 text-sm font-medium">No documents uploaded yet.</p>
                <Link to="/upload" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 mt-1 flex items-center gap-1">
                  Upload file to get started
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-4 group">
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <Link to={`/summary/${doc.id}`} className="text-sm font-semibold text-slate-200 hover:text-indigo-400 transition-colors truncate block">
                          {doc.filename}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{getFormatSize(doc.file_size)}</span>
                          <span>&bull;</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleFavorite(doc.id, doc.is_favorite)}
                        className={`p-2 rounded-lg hover:bg-white/5 transition-all ${
                          doc.is_favorite ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Side summary panel */}
        <div className="p-6 rounded-2xl glass-panel flex flex-col justify-between bg-gradient-to-br from-[#0f1420] to-[#161e30] border-indigo-500/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full"></div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 font-['Outfit']">Sandbox Summary</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              DocMind AI uses advanced vector search models and custom RAG prompts to search document text. Answers are based purely on your context.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl">
                <CheckCircleIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-300">Total Uploads: {documents.length}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl">
                <CheckCircleIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-300">Starred Files: {documents.filter(d => d.is_favorite).length}</span>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-white/5 text-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Secure Local Environment</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CheckCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
