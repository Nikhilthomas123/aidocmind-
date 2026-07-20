import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Cpu, Shield, Save, ArrowLeft, RefreshCw, Key } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [model, setModel] = useState('gpt-4o');
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('user_openai_key') || '');
  const [loading, setLoading] = useState(false);

  // Toast status
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.put('/api/auth/profile', {
        full_name: fullName,
        email: email
      });

      updateUser(response.data);
      setToastMessage('Profile updated successfully!');
      setToastType('success');
      setToastVisible(true);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'Failed to update profile settings.';
      setToastMessage(errMsg);
      setToastType('error');
      setToastVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAI = (e: React.FormEvent) => {
    e.preventDefault();
    setToastMessage('AI engine settings updated locally.');
    setToastType('success');
    setToastVisible(true);
    
    // Store user key preferences in session if supplied
    if (apiKey) {
      sessionStorage.setItem('user_openai_key', apiKey);
      axios.defaults.headers.common['X-OpenAI-Key'] = apiKey;
    } else {
      sessionStorage.removeItem('user_openai_key');
      delete axios.defaults.headers.common['X-OpenAI-Key'];
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 relative">
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
          <SettingsIcon className="w-6 h-6 text-indigo-400" />
          System Settings
        </h1>
        <p className="text-slate-400 text-xs mt-1">Configure profile details, LLM model instances, and system parameters.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Details Panel */}
        <div className="md:col-span-2 p-6 rounded-2xl glass-panel relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-200 font-['Outfit']">User Profile</h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Username</label>
              <input
                type="text"
                value={user?.username || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-500 text-sm cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Username cannot be changed once initialized.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="your full name"
                className="w-full px-4 py-2.5 rounded-xl glass-input text-slate-100 text-sm placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl glass-input text-slate-100 text-sm placeholder-slate-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm hover:from-indigo-600 hover:to-violet-600 transition-all shadow-md shadow-indigo-500/10 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile Changes
            </button>
          </form>
        </div>

        {/* AI Engine & API Keys Panel */}
        <div className="p-6 rounded-2xl glass-panel space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-200 font-['Outfit']">AI Settings</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Select model defaults. System will choose the backend instance unless overridden.
            </p>
          </div>

          <form onSubmit={handleSaveAI} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">GPT Engine Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full py-2.5 px-3 rounded-lg bg-[#080b11] border border-white/10 text-slate-200 text-xs"
              >
                <option value="gpt-4o">GPT-4o (Default Recommended)</option>
                <option value="gpt-4">GPT-4 (Accurate Processing)</option>
                <option value="gpt-3.5-turbo">GPT-3.5-Turbo (Fast/Light)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                Custom OpenAI Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-••••••••••••••••"
                className="w-full px-4 py-2.5 rounded-xl glass-input text-slate-100 text-sm placeholder-slate-500"
              />
              <span className="text-[10px] text-slate-500 mt-1.5 block">Overrides server default credentials. Keys are saved securely in session storage.</span>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/5 transition-all"
            >
              Update AI Parameters
            </button>
          </form>

          <hr className="border-white/5" />

          {/* Secure Warning badge */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-slate-400 text-xs leading-normal">
            <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <span>All document vectors and profiles are encrypted. Submissions are processed inside a private sandbox.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
