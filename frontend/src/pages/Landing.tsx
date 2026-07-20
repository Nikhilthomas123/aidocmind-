import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Brain, FileText, MessageSquare, Shield, Zap, Search, Download, Star, Sparkles } from 'lucide-react';

export const Landing: React.FC = () => {
  const { token } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  };

  const features = [
    {
      title: "Extensive Summarization",
      desc: "Instant Executive, Detailed, and Bullet summaries streaming token-by-token.",
      icon: <FileText className="w-6 h-6 text-indigo-400" />
    },
    {
      title: "AI Document Analysis",
      desc: "Extract action items, glossary terms, keywords, deadlines, writing tone, and sentiment.",
      icon: <Sparkles className="w-6 h-6 text-violet-400" />
    },
    {
      title: "Contextual RAG Chat",
      desc: "Chat with your document. Answers are guaranteed to be sourced ONLY from the uploaded text.",
      icon: <MessageSquare className="w-6 h-6 text-emerald-400" />
    },
    {
      title: "Smart Text Search",
      desc: "Search inside documents with smart term matches and highlight occurrences visually.",
      icon: <Search className="w-6 h-6 text-amber-400" />
    },
    {
      title: "Multi-Format Exporting",
      desc: "Export generated summaries and insights to styled PDF, DOCX, or raw TXT structures.",
      icon: <Download className="w-6 h-6 text-rose-400" />
    },
    {
      title: "Secure Vault",
      desc: "JWT-based authentication, user profile configurations, and robust session controls.",
      icon: <Shield className="w-6 h-6 text-cyan-400" />
    }
  ];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] rounded-full bg-violet-500/10 blur-[90px] pointer-events-none"></div>

      {/* Hero Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          {/* Tag */}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-6 shadow-sm shadow-indigo-500/10"
          >
            <Zap className="w-3.5 h-3.5" />
            Next-Gen RAG Document Intelligence
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 font-['Outfit']"
          >
            Unravel Document Insights With{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-md">
              DocMind AI
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed font-normal"
          >
            Upload PDFs, DOCX, or TXT documents. Extract 20+ types of AI insights, search with highlighting, export format reports, and chat securely inside a sandbox based strictly on your document's contents.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 items-center mb-24">
            <Link
              to={token ? "/dashboard" : "/register"}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white hover:opacity-95 transition-all shadow-xl shadow-indigo-500/20 hover:scale-[1.02]"
            >
              {token ? "Go to Dashboard" : "Get Started For Free"}
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold text-slate-300 bg-white/5 hover:bg-white/10 hover:text-slate-100 transition-all border border-white/5"
            >
              Explore Features
            </a>
          </motion.div>

          {/* Features Section Grid */}
          <motion.div
            id="features"
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl text-left"
          >
            {features.map((feat, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="p-6 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between"
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/10 mb-5 animate-float shadow-inner">
                    {feat.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mb-2 font-['Outfit']">{feat.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-6 text-center text-xs text-slate-500 relative z-10 bg-[#080b11]">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>&copy; {new Date().getFullYear()} DocMind AI. Built for secure production performance.</span>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
