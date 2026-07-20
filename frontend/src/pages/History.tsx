import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Toast } from '../components/Toast';
import { motion } from 'framer-motion';
import { History as HistoryIcon, Search, Star, Trash2, FileText, MessageSquare, BarChart3, ArrowLeft, ArrowRight, Loader2, Sparkles, Database } from 'lucide-react';

interface Document {
  id: number;
  filename: string;
  file_size: number;
  created_at: string;
  is_favorite: boolean;
}

export const History: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'favorites'>('all');

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
      setToastMessage('Failed to update status.');
      setToastType('error');
      setToastVisible(true);
    }
  };

  const deleteDocument = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document? This will remove all associated summaries, embeddings, and chat history.')) {
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
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Filter and Search matching documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterMode === 'all' || doc.is_favorite;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 relative">
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />

      {/* Back button */}
      <div className="mb-6">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-['Outfit'] flex items-center gap-2">
          <HistoryIcon className="w-6 h-6 text-indigo-400" />
          Document Repository
        </h1>
        <p className="text-slate-400 text-xs mt-1">Search, bookmark, inspect, and delete previously uploaded sandbox documents.</p>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 mb-8">
        {/* Toggle buttons */}
        <div className="flex gap-1.5 bg-black/25 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setFilterMode('all')}
            className={`flex-grow sm:flex-grow-0 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'all'
                ? 'bg-indigo-500/10 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Uploads ({documents.length})
          </button>
          <button
            onClick={() => setFilterMode('favorites')}
            className={`flex-grow sm:flex-grow-0 px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
              filterMode === 'favorites'
                ? 'bg-indigo-500/10 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            Favorites ({documents.filter(d => d.is_favorite).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#080b11] border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Documents Log List */}
      <div className="p-6 rounded-2xl glass-panel relative overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">Accessing sandbox directories...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Database className="w-12 h-12 text-slate-600 mb-4 opacity-40 animate-pulse" />
            <p className="text-slate-400 text-sm font-semibold">No records found matching criteria.</p>
            <p className="text-slate-500 text-xs mt-1">Upload a document to index search records.</p>
            <Link to="/upload" className="mt-4 px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold text-xs hover:bg-indigo-600 transition-all flex items-center gap-1.5 shadow-md">
              Upload Document
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  <th className="pb-3 pl-2">Name</th>
                  <th className="pb-3 hidden md:table-cell">File Size</th>
                  <th className="pb-3 hidden sm:table-cell">Uploaded At</th>
                  <th className="pb-3 text-right pr-2">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="group hover:bg-white/[0.01]">
                    <td className="py-4 pl-2 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 flex-shrink-0">
                          <FileText className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-slate-200 truncate block max-w-xs md:max-w-md">
                            {doc.filename}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-slate-400 text-xs hidden md:table-cell">
                      {getFormatSize(doc.file_size)}
                    </td>
                    <td className="py-4 text-slate-400 text-xs hidden sm:table-cell">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="py-4 text-right pr-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/summary/${doc.id}`}
                          className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-all text-xs font-semibold flex items-center gap-1"
                          title="View Summary"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">Summary</span>
                        </Link>
                        <Link
                          to={`/analysis/${doc.id}`}
                          className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-all text-xs font-semibold flex items-center gap-1"
                          title="Analysis"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">Analysis</span>
                        </Link>
                        <Link
                          to={`/chat/${doc.id}`}
                          className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all text-xs font-semibold flex items-center gap-1"
                          title="Open Chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">Chat</span>
                        </Link>
                        <div className="h-4 w-px bg-white/5 mx-1 hidden lg:block"></div>
                        <button
                          onClick={() => toggleFavorite(doc.id, doc.is_favorite)}
                          className={`p-2 rounded-lg hover:bg-white/5 transition-all ${
                            doc.is_favorite ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="Star Document"
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
