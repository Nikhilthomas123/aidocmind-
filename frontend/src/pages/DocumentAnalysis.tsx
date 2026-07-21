import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, FileText, MessageSquare, ArrowLeft, RefreshCw, Sparkles, Languages, HelpCircle, FileCheck, Landmark, Tag, CheckCircle2, XCircle, Award, RotateCcw, Check, Layers, Network } from 'lucide-react';

interface QuizQuestion {
  num: number;
  question: string;
  options: { key: string; text: string }[];
  correct: string;
  explanation: string;
}

const parseQuizText = (rawText: string): QuizQuestion[] => {
  if (!rawText) return [];
  const questions: QuizQuestion[] = [];
  
  const blocks = rawText.split(/(?:####\s*Question|\nQuestion|\n\d+\.\s*Question|\n\d+\:\s*)/i);
  
  blocks.forEach((block) => {
    if (!block.trim()) return;
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    
    let qText = "";
    const options: { key: string; text: string }[] = [];
    let correct = "A";
    let exp = "";
    
    lines.forEach(line => {
      if (line.match(/^-\s*\[\s*\]\s*([A-D])\)\s*(.*)/i) || line.match(/^-?\s*([A-D])\)\s*(.*)/i) || line.match(/^([A-D])[\.\)]\s*(.*)/i)) {
        const match = line.match(/^-\s*\[\s*\]\s*([A-D])\)\s*(.*)/i) || line.match(/^-?\s*([A-D])\)\s*(.*)/i) || line.match(/^([A-D])[\.\)]\s*(.*)/i);
        if (match) {
          const key = match[1].toUpperCase();
          if (!options.some(o => o.key === key)) {
            options.push({ key, text: match[2].trim() });
          }
        }
      } else if (line.toLowerCase().includes("correct answer")) {
        const match = line.match(/([A-D])/i);
        if (match) correct = match[1].toUpperCase();
      } else if (line.toLowerCase().includes("explanation")) {
        exp = line.replace(/^\*\*Explanation:\*\*/i, '').replace(/^Explanation:/i, '').trim();
      } else if (!qText && !line.startsWith("#") && !line.startsWith("*") && !line.startsWith("-")) {
        const cleaned = line.replace(/^(\d+:|\d+\.|\?)/, '').replace(/^Question \d+:/i, '').trim();
        if (cleaned) qText = cleaned;
      }
    });

    if (options.length >= 2) {
      questions.push({
        num: questions.length + 1,
        question: qText || `Question ${questions.length + 1}`,
        options,
        correct,
        explanation: exp || "Correct based on the document analysis."
      });
    }
  });
  
  return questions;
};

const QuizPlayer: React.FC<{ rawText: string }> = ({ rawText }) => {
  const questions = parseQuizText(rawText);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  if (questions.length === 0 || showRawText) {
    return (
      <div className="space-y-4">
        {questions.length > 0 && (
          <button
            onClick={() => setShowRawText(false)}
            className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold hover:bg-indigo-500/20 transition-all mb-4"
          >
            ← Back to Interactive Quiz Mode
          </button>
        )}
        <ReactMarkdown>{rawText}</ReactMarkdown>
      </div>
    );
  }

  const handleSelect = (qNum: number, key: string) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({ ...prev, [qNum]: key }));
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (selectedAnswers[q.num] === q.correct) score++;
    });
    return score;
  };

  const resetQuiz = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
  };

  const score = calculateScore();
  const percentage = Math.round((score / questions.length) * 100);

  return (
    <div className="space-y-6 text-slate-200">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/5">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-['Outfit']">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            Interactive Document Quiz ({questions.length} Questions)
          </h3>
          <p className="text-xs text-slate-400 mt-1">Select your answers below and submit to evaluate your document comprehension.</p>
        </div>
        <button
          onClick={() => setShowRawText(true)}
          className="text-xs font-medium text-slate-400 hover:text-slate-200 underline transition-colors"
        >
          View Raw Report
        </button>
      </div>

      {/* Score Banner when submitted */}
      {isSubmitted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
            percentage >= 80 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
            percentage >= 60 ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' :
            'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/10 flex-shrink-0">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-extrabold font-['Outfit']">Quiz Analysis Complete!</h4>
              <p className="text-xs opacity-90 mt-0.5">
                You scored <span className="font-bold text-white text-sm">{score} out of {questions.length}</span> ({percentage}%)
              </p>
            </div>
          </div>
          <button
            onClick={resetQuiz}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </motion.div>
      )}

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((q) => {
          const userChoice = selectedAnswers[q.num];
          const isCorrect = userChoice === q.correct;

          return (
            <div
              key={q.num}
              className={`p-5 rounded-2xl border transition-all ${
                isSubmitted
                  ? isCorrect
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-rose-500/5 border-rose-500/20'
                  : 'bg-white/5 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">
                  Question {q.num} of {questions.length}
                </span>
                {isSubmitted && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                    isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                )}
              </div>

              <h4 className="text-sm font-bold text-slate-100 mb-4 leading-snug">{q.question}</h4>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {q.options.map(opt => {
                  const isSelected = userChoice === opt.key;
                  const isCorrectChoice = opt.key === q.correct;

                  let cardStyle = "bg-[#080b11] border-white/10 hover:border-indigo-500/40 text-slate-300";
                  if (isSubmitted) {
                    if (isCorrectChoice) {
                      cardStyle = "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 font-semibold";
                    } else if (isSelected && !isCorrect) {
                      cardStyle = "bg-rose-500/20 border-rose-500/50 text-rose-200 line-through opacity-80";
                    } else {
                      cardStyle = "bg-[#080b11]/50 border-white/5 text-slate-500 opacity-60";
                    }
                  } else if (isSelected) {
                    cardStyle = "bg-indigo-500/20 border-indigo-500 text-indigo-200 font-semibold shadow-md shadow-indigo-500/10";
                  }

                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSelect(q.num, opt.key)}
                      disabled={isSubmitted}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center gap-2.5 ${cardStyle}`}
                    >
                      <span className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                        isSelected || (isSubmitted && isCorrectChoice) ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'
                      }`}>
                        {opt.key}
                      </span>
                      <span className="flex-grow">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation box when submitted */}
              {isSubmitted && (
                <div className="mt-3 p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 leading-relaxed">
                  <span className="font-bold text-indigo-400 block mb-1">💡 Answer Analysis & Explanation:</span>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Action */}
      {!isSubmitted ? (
        <button
          onClick={() => setIsSubmitted(true)}
          disabled={Object.keys(selectedAnswers).length === 0}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Submit Quiz & Analyze Answers ({Object.keys(selectedAnswers).length}/{questions.length} Answered)
        </button>
      ) : (
        <button
          onClick={resetQuiz}
          className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/5 transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Choices & Try Quiz Again
        </button>
      )}
    </div>
  );
};

/* Interactive Flashcards Component */
interface Flashcard {
  num: number;
  title: string;
  front: string;
  back: string;
}

const parseFlashcardsText = (rawText: string): Flashcard[] => {
  if (!rawText) return [];
  const cards: Flashcard[] = [];
  
  // Split into blocks by Flashcard headings or numbers
  const blocks = rawText.split(/(?:####\s*Flashcard|\nFlashcard|\n\d+[\.\:]\s*Flashcard|\n\d+[\.\:]\s*Card|\n---)/i);

  blocks.forEach(block => {
    if (!block.trim()) return;
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    let title = "";
    let front = "";
    let back = "";

    lines.forEach(line => {
      if (line.match(/^\*\*Front:\*\*/i) || line.match(/^Front:/i)) {
        front = line.replace(/^\*\*Front:\*\*/i, '').replace(/^Front:/i, '').replace(/[\*\#]/g, '').trim();
      } else if (line.match(/^\*\*Back:\*\*/i) || line.match(/^Back:/i)) {
        back = line.replace(/^\*\*Back:\*\*/i, '').replace(/^Back:/i, '').replace(/[\*\#]/g, '').trim();
      } else if (!title && !line.startsWith("#") && !line.startsWith("*") && !line.startsWith("-")) {
        title = line.replace(/^(\d+:|\d+\.)/, '').replace(/^Flashcard \d+:/i, '').replace(/[\*\#]/g, '').trim();
      }
    });

    if (front || back) {
      cards.push({
        num: cards.length + 1,
        title: title || `Concept ${cards.length + 1}`,
        front: front || title || "Concept Question",
        back: back || "Detailed Explanation"
      });
    }
  });

  return cards;
};

const FlashcardsPlayer: React.FC<{ rawText: string }> = ({ rawText }) => {
  const parsedCards = parseFlashcardsText(rawText);
  const [customCards, setCustomCards] = useState<Flashcard[]>([]);
  const allCards = [...parsedCards, ...customCards];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  // Custom Flashcard Creation Form State
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    const newCard: Flashcard = {
      num: allCards.length + 1,
      title: newTitle.trim() || `Custom Card ${customCards.length + 1}`,
      front: newFront.trim(),
      back: newBack.trim()
    };

    setCustomCards(prev => [...prev, newCard]);
    setNewTitle('');
    setNewFront('');
    setNewBack('');
    setIsAddingCard(false);
    setCurrentIndex(allCards.length);
    setIsFlipped(false);
  };

  if (allCards.length === 0 || showRawText) {
    return (
      <div className="space-y-4">
        {allCards.length > 0 && (
          <button
            onClick={() => setShowRawText(false)}
            className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold hover:bg-indigo-500/20 transition-all mb-4"
          >
            ← Back to Interactive Flashcards Mode
          </button>
        )}
        <ReactMarkdown>{rawText}</ReactMarkdown>
      </div>
    );
  }

  const currentCard = allCards[currentIndex] || allCards[0];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % allCards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + allCards.length) % allCards.length);
  };

  return (
    <div className="space-y-6 text-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/5">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-['Outfit']">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Interactive Study Flashcards ({allCards.length} Cards)
          </h3>
          <p className="text-xs text-slate-400 mt-1">Click the card to flip between Front (Question) and Back (Answer).</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingCard(!isAddingCard)}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-600 transition-all flex items-center gap-1.5"
          >
            {isAddingCard ? 'Cancel' : '+ Add Flashcard'}
          </button>

          <button
            onClick={() => setShowRawText(true)}
            className="text-xs font-medium text-slate-400 hover:text-slate-200 underline transition-colors"
          >
            View Raw Text
          </button>
        </div>
      </div>

      {/* Inline Form to Add Custom Flashcard */}
      {isAddingCard && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAddCard}
          className="p-5 rounded-2xl bg-white/5 border border-indigo-500/30 space-y-4"
        >
          <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-['Outfit']">Create Custom Flashcard</h4>
          
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Card Concept Title (Optional)</label>
            <input
              type="text"
              placeholder="e.g. System Protocol"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#080b11] border border-white/10 text-xs text-slate-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-indigo-400 uppercase tracking-wider mb-1 font-semibold">Front Side (Question / Concept)*</label>
              <textarea
                required
                rows={3}
                placeholder="Enter the question or concept..."
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#080b11] border border-indigo-500/30 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[10px] text-emerald-400 uppercase tracking-wider mb-1 font-semibold">Back Side (Answer / Explanation)*</label>
              <textarea
                required
                rows={3}
                placeholder="Enter the answer or explanation..."
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#080b11] border border-emerald-500/30 text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingCard(false)}
              className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-semibold hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 shadow-md shadow-indigo-500/20"
            >
              Add Card to Deck
            </button>
          </div>
        </motion.form>
      )}

      {/* Progress header */}
      <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
        <span>Card {currentIndex + 1} of {allCards.length}</span>
        <span className="text-indigo-400 font-bold">{currentCard.title}</span>
      </div>

      {/* 3D Flip Card Container */}
      <div className="my-6 perspective-1000">
        <motion.div
          onClick={() => setIsFlipped(!isFlipped)}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ transformStyle: "preserve-3d" }}
          className={`w-full min-h-[260px] p-8 rounded-3xl cursor-pointer border transition-colors flex flex-col justify-between items-center text-center shadow-2xl relative ${
            isFlipped
              ? 'bg-gradient-to-br from-emerald-950/60 via-teal-900/40 to-slate-900 border-emerald-500/40 text-slate-100 shadow-emerald-500/10'
              : 'bg-gradient-to-br from-slate-900 via-[#0a0d16] to-slate-900 border-white/10 hover:border-indigo-500/40 text-slate-200 shadow-indigo-500/10'
          }`}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
        >
          <div 
            className="w-full flex justify-between items-center text-[11px] uppercase tracking-widest font-bold"
            style={{ transform: isFlipped ? "rotateY(180deg)" : "none" }}
          >
            <span className={isFlipped ? 'text-emerald-400 font-extrabold flex items-center gap-1.5' : 'text-indigo-400 font-extrabold flex items-center gap-1.5'}>
              {isFlipped ? '💡 BACK SIDE: ANSWER / EXPLANATION' : '❓ FRONT SIDE: QUESTION / CONCEPT'}
            </span>
            <span className="text-slate-400 text-[10px] bg-white/5 px-2.5 py-1 rounded-md border border-white/5">Click Card to Flip 🔄</span>
          </div>

          <div 
            className="py-6 px-4 my-auto"
            style={{ transform: isFlipped ? "rotateY(180deg)" : "none" }}
          >
            <h4 className="text-lg sm:text-xl font-bold leading-relaxed font-['Outfit']">
              {isFlipped ? currentCard.back : currentCard.front}
            </h4>
          </div>

          <div 
            className="text-xs text-slate-400"
            style={{ transform: isFlipped ? "rotateY(180deg)" : "none" }}
          >
            {isFlipped ? 'Click card again to show question (Front)' : 'Click card to reveal answer (Back)'}
          </div>
        </motion.div>
      </div>

      {/* Card Controls */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={handlePrev}
          className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/5 transition-all"
        >
          ← Previous
        </button>

        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="px-6 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold text-xs border border-indigo-500/30 transition-all"
        >
          {isFlipped ? 'Show Front Question ❓' : 'Flip to Back Answer 💡'}
        </button>

        <button
          onClick={handleNext}
          className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/5 transition-all"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

/* Visual Mind Map Viewer Component */
interface MindMapNode {
  title: string;
  subNodes: string[];
}

interface MindMapStructure {
  centralTopic: string;
  branches: MindMapNode[];
}

const parseMindMapText = (rawText: string): MindMapStructure => {
  if (!rawText || !rawText.trim()) {
    return {
      centralTopic: "Document Subject Overview",
      branches: [
        {
          title: "Document Core Concepts",
          subNodes: ["Extracting document structure and concept hierarchy..."]
        }
      ]
    };
  }
  
  let centralTopic = "Document Content Overview";
  const branches: MindMapNode[] = [];
  
  const rawLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  let currentBranch: MindMapNode | null = null;

  for (const line of rawLines) {
    if (line.match(/^###?\s*(?:Simple\s*|Visual\s*|Document\s*|Tree\s*|Flowchart\s*)?Mind\s*Map/i)) continue;

    if (line.toLowerCase().includes("central topic:")) {
      centralTopic = line.replace(/.*central topic:\s*/i, '').replace(/[\*\_\#]/g, '').trim();
    } else if (line.match(/^(?:-\s*)?\*\*Branch\s*\d+:?\s*(.*?)\*\*/i) || line.match(/^####?\s*(.*)/i) || line.match(/^\d+\.\s*\*\*(.*?)\*\*/i) || line.match(/^###?\s*(.*)/i)) {
      if (currentBranch && (currentBranch.title || currentBranch.subNodes.length > 0)) {
        branches.push(currentBranch);
      }
      const title = line
        .replace(/^(?:-\s*)?\*\*/, '')
        .replace(/\*\*/g, '')
        .replace(/^####?\s*/, '')
        .replace(/^###?\s*/, '')
        .replace(/^Branch\s*\d+:?\s*/i, '')
        .replace(/^Section\s*\d+:?\s*/i, '')
        .trim();

      if (title && !title.toLowerCase().includes("mind map") && !title.toLowerCase().startsWith("central topic:")) {
        currentBranch = { title: title || `Branch ${branches.length + 1}`, subNodes: [] };
      }
    } else if (line.startsWith("-") || line.startsWith("*") || line.startsWith("•") || line.match(/^\d+[\.\)]/)) {
      const item = line.replace(/^[-*•\d\.\)]\s*/, '').replace(/[\*\_\#]/g, '').trim();
      if (item) {
        if (!currentBranch) {
          currentBranch = { title: "Document Overview & Key Items", subNodes: [] };
        }
        if (!item.toLowerCase().startsWith("central topic:")) {
          currentBranch.subNodes.push(item);
        }
      }
    } else if (line.length > 10) {
      const cleanLine = line.replace(/[\*\_\#]/g, '').trim();
      if (cleanLine && !cleanLine.toLowerCase().includes("mind map") && !cleanLine.toLowerCase().startsWith("central topic:")) {
        if (!currentBranch) {
          currentBranch = { title: "Document Overview & Core Points", subNodes: [] };
        }
        currentBranch.subNodes.push(cleanLine);
      }
    }
  }

  if (currentBranch && (currentBranch.title || currentBranch.subNodes.length > 0)) {
    branches.push(currentBranch);
  }

  // Fallback guarantee: Never return empty branches!
  if (branches.length === 0) {
    branches.push({
      title: "Document Highlights & Key Outline",
      subNodes: rawLines.length > 0 ? rawLines.slice(0, 8) : ["Document concept overview."]
    });
  }

  return { centralTopic, branches };
};

const MindMapViewer: React.FC<{ rawText: string }> = ({ rawText }) => {
  const { centralTopic, branches } = parseMindMapText(rawText);
  const [viewMode, setViewMode] = useState<'tree' | 'flowchart' | 'markdown'>('tree');

  if (viewMode === 'markdown') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setViewMode('tree')}
          className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold hover:bg-indigo-500/20 transition-all mb-4"
        >
          ← Back to Tree Diagram View
        </button>
        <ReactMarkdown>{rawText}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/5">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-['Outfit']">
            <Network className="w-5 h-5 text-indigo-400" />
            Document Mind Map Tree
          </h3>
          <p className="text-xs text-slate-400 mt-1">Hierarchical tree diagram representation connecting root topics and sub-branches.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              viewMode === 'tree'
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-bold'
                : 'bg-white/5 text-slate-400 border-white/5 hover:text-slate-200'
            }`}
          >
            🌲 Tree Diagram View
          </button>

          <button
            onClick={() => setViewMode('flowchart')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              viewMode === 'flowchart'
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-bold'
                : 'bg-white/5 text-slate-400 border-white/5 hover:text-slate-200'
            }`}
          >
            ⚡ Flowchart View
          </button>

          <button
            onClick={() => setViewMode('markdown')}
            className="text-xs font-medium text-slate-400 hover:text-slate-200 underline transition-colors ml-2"
          >
            Markdown
          </button>
        </div>
      </div>

      {/* View 1: Connected Tree Diagram Map (DEFAULT) */}
      {viewMode === 'tree' && (
        <div className="p-6 rounded-2xl bg-[#070a12] border border-indigo-500/20 font-mono text-xs text-slate-200 overflow-x-auto shadow-2xl space-y-6">
          <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-900/40 to-violet-900/30 p-3.5 rounded-xl border border-indigo-500/30 w-fit">
            <span className="text-lg">🧠</span>
            <div>
              <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-extrabold block">Root Central Topic</span>
              <span className="text-sm font-extrabold text-slate-100 font-['Outfit']">{centralTopic}</span>
            </div>
          </div>

          <div className="pl-4 space-y-5 pt-1 border-l-2 border-indigo-500/20 ml-5">
            {branches.map((b, bIdx) => {
              const isLastBranch = bIdx === branches.length - 1;
              const branchConnector = isLastBranch ? "└── " : "├── ";
              const subPrefix = isLastBranch ? "    " : "│   ";

              return (
                <div key={bIdx} className="space-y-2 relative">
                  <div className="flex items-center gap-2 text-violet-300 font-bold text-xs">
                    <span className="text-indigo-400 select-none font-bold text-sm">{branchConnector}</span>
                    <span className="bg-indigo-500/15 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/30 flex items-center gap-1.5 font-['Outfit']">
                      📌 Branch {bIdx + 1}: {b.title}
                    </span>
                  </div>

                  <div className="space-y-1.5 pl-2">
                    {b.subNodes.map((sub, sIdx) => {
                      const isLastSub = sIdx === b.subNodes.length - 1;
                      const nodeConnector = isLastSub ? "└── " : "├── ";

                      return (
                        <div key={sIdx} className="flex items-start gap-1.5 text-slate-300 pl-4">
                          <span className="text-slate-600 select-none font-bold">{subPrefix}</span>
                          <span className="text-indigo-400 select-none font-bold">{nodeConnector}</span>
                          <span className="bg-white/5 hover:bg-white/10 px-3 py-1 rounded-md text-slate-200 border border-white/5 leading-relaxed font-sans text-xs transition-colors">
                            🔹 {sub}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View 2: Flowchart Diagram */}
      {viewMode === 'flowchart' && (
        <div className="flex flex-col items-center my-4 space-y-6">
          {/* Central Start Node Box */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="px-8 py-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-indigo-500/20 border border-white/20 text-center max-w-xl font-['Outfit'] tracking-wide"
          >
            <span className="text-[10px] text-indigo-200 uppercase tracking-widest block mb-1 font-mono font-bold">⚡ START NODE / CENTRAL SUBJECT</span>
            🧠 {centralTopic}
          </motion.div>

          {/* Flow Direction Arrow */}
          <div className="flex flex-col items-center text-indigo-400">
            <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-500 to-violet-500"></div>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 my-1">⬇ PROCESS FLOW</span>
            <div className="w-0.5 h-6 bg-gradient-to-b from-violet-500 to-indigo-500"></div>
          </div>

          {/* Sequential Flowchart Stage Cards */}
          <div className="w-full space-y-6">
            {branches.map((b, idx) => (
              <motion.div
                key={idx}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="relative"
              >
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-[#0a0d16] to-slate-900 border border-white/10 hover:border-indigo-500/40 shadow-xl space-y-4">
                  {/* Flowchart Stage Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-center font-mono font-bold">{idx + 1}</span>
                      📌 STAGE {idx + 1}: {b.title}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/5 font-mono">FLOWCHART NODE</span>
                  </div>

                  {/* Flowchart Sub-steps with Connecting Arrows */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {b.subNodes.map((sub, sIdx) => (
                      <div key={sIdx} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all flex items-start gap-2.5">
                        <span className="text-indigo-400 font-bold text-sm flex-shrink-0">➔</span>
                        <div className="text-xs text-slate-200 leading-relaxed">
                          <span className="text-indigo-300 font-semibold mr-1">🔹</span>
                          {sub}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Downward Flow Arrow Between Stages */}
                {idx < branches.length - 1 && (
                  <div className="flex flex-col items-center my-3 text-indigo-400">
                    <div className="w-0.5 h-5 bg-gradient-to-b from-indigo-500/50 to-indigo-500"></div>
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">⬇ STEP FLOW</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const DocumentAnalysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const [docName, setDocName] = useState('');
  const [activeCategory, setActiveCategory] = useState<'overview' | 'insights' | 'entities' | 'faq' | 'tools'>('overview');
  
  // Analysis metrics
  const [metrics, setMetrics] = useState<any>({
    word_count: 0,
    reading_time: 0,
    sentiment: 'Loading...',
    tone: 'Loading...',
    difficulty: 'Loading...',
    language: 'Loading...',
    classification: 'Loading...'
  });

  const [activeOutput, setActiveOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  
  // Form selection inputs for extra tools
  const [selectedTool, setSelectedTool] = useState('quiz');
  const [quizDifficulty, setQuizDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  // Cache of pre-generated reports to avoid query lag
  const [reports, setReports] = useState<Record<string, string>>({});

  // Toast status
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const fetchDocInfo = async () => {
      if (!id) return;
      try {
        const response = await axios.get(`/api/documents/${id}`);
        setDocName(response.data.filename);
        if (response.data.metrics) {
          setMetrics(response.data.metrics);
        }
        
        const initialReports: Record<string, string> = {};
        if (response.data.analysis_takeaways) initialReports['insights'] = response.data.analysis_takeaways;
        if (response.data.analysis_entities) initialReports['entities'] = response.data.analysis_entities;
        if (response.data.analysis_faq) initialReports['faq'] = response.data.analysis_faq;
        setReports(initialReports);

        if (!response.data.metrics) {
          fetchMetrics();
        }
      } catch (err) {
        console.error(err);
        setToastMessage('Failed to load document info.');
        setToastType('error');
        setToastVisible(true);
      }
    };

    fetchDocInfo();
  }, [id]);

  const fetchMetrics = async () => {
    try {
      const response = await axios.post(`/api/documents/${id}/metrics`);
      setMetrics(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const streamReport = async (category: string) => {
    setStreaming(true);
    setActiveOutput('');

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };
      const userKey = sessionStorage.getItem('user_openai_key');
      if (userKey) {
        headers['X-OpenAI-Key'] = userKey;
      }

      const response = await fetch(`/api/documents/${id}/stream-analysis?category=${category}`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis stream');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) return;

      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunks = decoder.decode(value, { stream: true }).split('\n\n');
        for (const chunk of chunks) {
          if (chunk.startsWith('data: ')) {
            const content = chunk.substring(6);
            if (content === '[DONE]') break;
            accumulated += content;
            setActiveOutput(accumulated);
          } else if (chunk.trim() !== '') {
            accumulated += chunk;
            setActiveOutput(accumulated);
          }
        }
      }

      setReports(prev => ({ ...prev, [category]: accumulated }));
    } catch (err) {
      console.error(err);
      setToastMessage('Failed to stream analysis report.');
      setToastType('error');
      setToastVisible(true);
    } finally {
      setStreaming(false);
    }
  };

  const triggerSpecificTool = async (toolName: string, difficulty?: string) => {
    setStreaming(true);
    setActiveOutput('');

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };
      const userKey = sessionStorage.getItem('user_openai_key');
      if (userKey) {
        headers['X-OpenAI-Key'] = userKey;
      }

      let url = `/api/documents/${id}/stream-tool?tool=${toolName}`;
      if (toolName === 'quiz' && difficulty) {
        url += `&difficulty=${encodeURIComponent(difficulty)}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error('Failed to run AI tool');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) return;

      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunks = decoder.decode(value, { stream: true }).split('\n\n');
        for (const chunk of chunks) {
          if (chunk.startsWith('data: ')) {
            const content = chunk.substring(6);
            if (content === '[DONE]') break;
            accumulated += content;
            setActiveOutput(accumulated);
          } else if (chunk.trim() !== '') {
            accumulated += chunk;
            setActiveOutput(accumulated);
          }
        }
      }
      setReports(prev => ({ ...prev, [toolName]: accumulated }));
    } catch (err) {
      console.error(err);
      setToastMessage('Failed to execute AI tool.');
      setToastType('error');
      setToastVisible(true);
    } finally {
      setStreaming(false);
    }
  };

  const triggerTool = async () => {
    await triggerSpecificTool(selectedTool, quizDifficulty);
  };

  const handleTabChange = (category: 'overview' | 'insights' | 'entities' | 'faq' | 'tools') => {
    setActiveCategory(category);
    if (category === 'overview') {
      setActiveOutput('');
      return;
    }
    if (category === 'tools') {
      setActiveOutput(reports[selectedTool] || '');
      return;
    }

    if (reports[category]) {
      setActiveOutput(reports[category]);
    } else {
      streamReport(category);
    }
  };

  const tools = [
    { id: 'quiz', name: 'Generate Quiz (5 Questions)' },
    { id: 'simplify', name: 'Simplify Language (ELI5)' },
    { id: 'professional', name: 'Professional Rewrite' },
    { id: 'notes', name: 'Generate Meeting Notes' },
    { id: 'email', name: 'Generate Email Draft' },
    { id: 'blog', name: 'Generate Blog Post' },
    { id: 'linkedin', name: 'Generate LinkedIn Post' },
    { id: 'questions', name: 'Generate Interview Questions' }
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 relative">
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />

      {/* Top Nav Breadcrumbs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
          <Link to={`/summary/${id}`} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            AI Summary
          </Link>
          <Link to={`/analysis/${id}`} className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Analysis
          </Link>
          <Link to={`/chat/${id}`} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            AI Chat
          </Link>
        </div>
      </div>

      {/* Header Title */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight truncate max-w-3xl font-['Outfit']">
          {docName || 'Loading Document Analysis...'}
        </h1>
        <p className="text-slate-400 text-xs mt-1">Audit statistics, review insights, and generate custom tools or interactive quizzes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-3">
          <div className="p-4 rounded-2xl glass-panel space-y-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3 pl-1">Analyzer Workspace</span>
            
            <button
              onClick={() => handleTabChange('overview')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeCategory === 'overview'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Document Overview
            </button>

            <button
              onClick={() => handleTabChange('insights')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeCategory === 'insights'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              Key Insights & Action
            </button>

            <button
              onClick={() => handleTabChange('entities')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeCategory === 'entities'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <Tag className="w-4 h-4" />
              Entities & Glossary
            </button>

            <button
              onClick={() => handleTabChange('faq')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeCategory === 'faq'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              FAQs & Improvements
            </button>

            <button
              onClick={() => handleTabChange('tools')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeCategory === 'tools'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI Quiz & Draft Tools
            </button>
          </div>

          {activeCategory !== 'overview' && activeCategory !== 'tools' && (
            <button
              onClick={() => streamReport(activeCategory)}
              disabled={streaming}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${streaming ? 'animate-spin' : ''}`} />
              {streaming ? 'Generating...' : 'Re-generate Reports'}
            </button>
          )}
        </div>

        {/* Main Content Workspace */}
        <div className="lg:col-span-3 p-6 rounded-2xl glass-panel flex flex-col justify-between min-h-[500px]">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 pb-4 mb-6 border-b border-white/5 uppercase tracking-wider font-['Outfit']">
              <BarChart3 className="w-3.5 h-3.5" />
              {activeCategory} Panel
            </div>

            {/* Overview View */}
            {activeCategory === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Document Metadata</span>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Total Word Count</span>
                    <span className="font-bold text-slate-200">{metrics.word_count || 'Loading...'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Estimated Reading Time</span>
                    <span className="font-bold text-slate-200">{metrics.reading_time ? `${metrics.reading_time} min` : 'Loading...'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Language Detected</span>
                    <span className="font-bold text-slate-200">{metrics.language || 'Loading...'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">AI Classification</span>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Writing Tone</span>
                    <span className="font-bold text-slate-200">{metrics.tone || 'Loading...'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Difficulty Grade</span>
                    <span className="font-bold text-slate-200">{metrics.difficulty || 'Loading...'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Sentiment Score</span>
                    <span className="font-bold text-slate-200">{metrics.sentiment || 'Loading...'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5 md:col-span-2 space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Categorization Category</span>
                  <span className="text-base font-bold text-slate-200 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-indigo-400" />
                    {metrics.classification || 'Loading...'}
                  </span>
                </div>
              </div>
            )}



            {/* Render Extra AI Tools parameters */}
            {activeCategory === 'tools' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-white/5 p-4 rounded-xl border border-white/5">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Select AI Feature / Tool</label>
                    <select
                      value={selectedTool}
                      onChange={(e) => setSelectedTool(e.target.value)}
                      className="w-full py-2.5 px-3 rounded-lg bg-[#080b11] border border-white/10 text-slate-200 text-xs font-semibold"
                    >
                      {tools.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedTool === 'quiz' ? (
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Quiz Difficulty Level</label>
                      <select
                        value={quizDifficulty}
                        onChange={(e) => setQuizDifficulty(e.target.value as any)}
                        className="w-full py-2.5 px-3 rounded-lg bg-[#080b11] border border-white/10 text-indigo-300 text-xs font-bold"
                      >
                        <option value="Easy">Easy (Fact Recall)</option>
                        <option value="Medium">Medium (Standard Analysis)</option>
                        <option value="Hard">Hard (Deep Logic & Reasoning)</option>
                      </select>
                    </div>
                  ) : null}

                  <button
                    onClick={triggerTool}
                    disabled={streaming}
                    className="w-full sm:col-span-3 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {streaming ? 'Generating Content...' : `Generate ${tools.find(t => t.id === selectedTool)?.name || 'Feature'}`}
                  </button>
                </div>

                <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-300 bg-white/5 p-5 rounded-xl border border-white/5 min-h-[300px]">
                  {activeOutput ? (
                    selectedTool === 'quiz' ? (
                      <QuizPlayer rawText={activeOutput} />
                    ) : (
                      <ReactMarkdown>{activeOutput}</ReactMarkdown>
                    )
                  ) : (
                    <div className="text-center py-16 text-slate-500">
                      <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30 text-indigo-400" />
                      <p className="font-semibold text-xs text-slate-400">Select a tool above and click Generate to create an interactive Quiz or AI draft.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* General category streaming rendering */}
            {activeCategory !== 'overview' && activeCategory !== 'tools' && (
              <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-300">
                {activeOutput ? (
                  <ReactMarkdown>{activeOutput}</ReactMarkdown>
                ) : streaming ? (
                  <div className="flex items-center gap-2 text-slate-500 py-6">
                    <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                    <span>AI is reading and parsing document metrics...</span>
                  </div>
                ) : (
                  <div className="text-center py-20 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="font-semibold text-sm">No report generated for this category yet.</p>
                    <button
                      onClick={() => streamReport(activeCategory)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 mt-2 hover:underline"
                    >
                      Generate details now
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 text-right">
            <span className="text-[10px] text-slate-500">Powered by DocMind AI Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
};
