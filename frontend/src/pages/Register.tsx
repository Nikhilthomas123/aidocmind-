import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Brain, Lock, Mail, User, ArrowRight } from 'lucide-react';

export const Register: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Toast status
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) {
      setToastMessage('Please fill in all required fields.');
      setToastType('error');
      setToastVisible(true);
      return;
    }

    if (password !== confirmPassword) {
      setToastMessage('Passwords do not match.');
      setToastType('error');
      setToastVisible(true);
      return;
    }

    if (password.length < 6) {
      setToastMessage('Password must be at least 6 characters long.');
      setToastType('error');
      setToastVisible(true);
      return;
    }

    setLoading(true);
    try {
      // API call to registration endpoint
      const response = await axios.post('/api/auth/signup', {
        username,
        email,
        full_name: fullName || undefined,
        password
      });

      const { access_token, user } = response.data;
      signup(access_token, user);
      
      setToastMessage('Account created successfully! Redirecting...');
      setToastType('success');
      setToastVisible(true);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Registration failed. Username or email might be taken.';
      setToastMessage(errMsg);
      setToastType('error');
      setToastVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      {/* Background circles */}
      <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-1/3 right-1/3 w-[250px] h-[250px] rounded-full bg-violet-500/10 blur-[70px] pointer-events-none"></div>

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md p-8 rounded-2xl glass-panel relative z-10 shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/20 mb-4">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight font-['Outfit'] text-slate-100">Create Account</h2>
          <p className="text-sm text-slate-400 mt-1.5">Register for a free DocMind AI sandbox</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Username *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="choose a username"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-slate-100 text-sm placeholder-slate-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email Address *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-slate-100 text-sm placeholder-slate-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="your name (optional)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-slate-100 text-sm placeholder-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least 6 characters"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-slate-100 text-sm placeholder-slate-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="re-enter password"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-slate-100 text-sm placeholder-slate-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm hover:from-indigo-600 hover:to-violet-600 focus:outline-none transition-all shadow-md shadow-indigo-500/15 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                Register Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            Log In
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
