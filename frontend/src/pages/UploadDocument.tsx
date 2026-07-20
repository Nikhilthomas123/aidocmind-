import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { Toast } from '../components/Toast';
import { motion } from 'framer-motion';
import { Upload, FileText, ArrowLeft, X, Check, Brain, Loader2 } from 'lucide-react';

export const UploadDocument: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  // Toast status
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxSize: 20 * 1024 * 1024, // 20MB
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setStatusText('Uploading file...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          const percent = Math.round((progressEvent.loaded * 100) / total);
          setProgress(percent);
          if (percent === 100) {
            setStatusText('Parsing text and generating chunks...');
          }
        }
      });

      setStatusText('Generating summary insights...');
      const docId = response.data.id;

      setToastMessage('Document parsed successfully!');
      setToastType('success');
      setToastVisible(true);

      setTimeout(() => {
        navigate(`/summary/${docId}`);
      }, 1200);

    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'Failed to upload or parse document.';
      setToastMessage(errMsg);
      setToastType('error');
      setToastVisible(true);
      setUploading(false);
      setProgress(0);
    }
  };

  const getFormatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 relative z-10">
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />

      {/* Back button */}
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="p-8 rounded-3xl glass-panel relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full"></div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-['Outfit']">Upload Document</h1>
          <p className="text-slate-400 text-sm mt-1.5">Load PDF, DOCX, or TXT documents for parsing and summary analysis.</p>
        </div>

        {/* Drag and drop zone */}
        {!file && !uploading && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
              isDragActive
                ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5'
                : 'border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center">
              <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-200">
                {isDragActive ? 'Drop your document here' : 'Drag & drop your document'}
              </p>
              <p className="text-xs text-slate-500 mt-1.5">or click to browse files from your computer</p>
              <div className="flex gap-4 mt-6 text-xs text-slate-400">
                <span className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg">PDF</span>
                <span className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg">DOCX</span>
                <span className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg">TXT</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-4 uppercase tracking-widest font-semibold">Maximum file size: 20MB</p>
            </div>
          </div>
        )}

        {/* Selected file preview */}
        {file && !uploading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-200 truncate">{file.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{getFormatSize(file.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFile(null)}
                className="p-2 text-slate-400 hover:text-slate-200 transition-colors hover:bg-white/5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Upload progress & state */}
        {uploading && (
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-slate-300 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                {statusText}
              </span>
              <span className="text-indigo-400">{progress}%</span>
            </div>

            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              ></motion.div>
            </div>
            <p className="text-xs text-slate-500 text-center">Do not close this tab. Processing is running securely in your sandbox.</p>
          </div>
        )}

        {/* Action Button */}
        {file && !uploading && (
          <button
            onClick={handleUpload}
            className="w-full py-3.5 mt-6 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-sm hover:from-indigo-600 hover:to-violet-600 transition-all shadow-md shadow-indigo-500/10"
          >
            Start Analyzing Document
          </button>
        )}
      </div>
    </div>
  );
};
