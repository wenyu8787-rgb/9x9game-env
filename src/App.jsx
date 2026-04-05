import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { Trophy, Play, Send, RefreshCw, Clock, Star, Zap } from 'lucide-react';
import { auth, db } from './firebase'; // 引入獨立的 firebase 設定

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [activeMoleIndex, setActiveMoleIndex] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState({ text: '?', answer: null, options: [] });
  const [feedback, setFeedback] = useState(null);
  
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef(null);
  const moleTimeoutRef = useRef(null);

  // 初始化 Firebase 匿名登入
  useEffect(() => {
    signInAnonymously(auth).catch(error => console.error("Auth error:", error));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 監聽排行榜
  useEffect(() => {
    if (!user) return;
    const scoresRef = collection(db, 'leaderboard'); // 修改為標準的 collection 根路徑
    const unsubscribe = onSnapshot(scoresRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      const sorted = data.sort((a, b) => b.score - a.score).slice(0, 10);
      setLeaderboard(sorted);
    }, (err) => console.error("Firestore error:", err));
    return () => unsubscribe();
  }, [user]);

  // 產生題目
  const generateQuestion = useCallback(() => {
    const n1 = Math.floor(Math.random() * 8) + 2;
    const n2 = Math.floor(Math.random() * 8) + 2;
    const answer = n1 * n2;
    
    let options = [answer];
    while (options.length < 3) {
      const offset = Math.floor(Math.random() * 10) + 1;
      const wrong = Math.random() > 0.5 ? answer + offset : answer - offset;
      if (wrong > 0 && !options.includes(wrong)) options.push(wrong);
    }
    return { text: `${n1} x ${n2}`, answer, options: options.sort(() => Math.random() - 0.5) };
  }, []);

  // 顯示地鼠
  const spawnMole = useCallback(() => {
    if (!isPlaying) return;
    const nextIndex = Math.floor(Math.random() * 6);
    setCurrentQuestion(generateQuestion());
    setActiveMoleIndex(nextIndex);
    
    const stayTime = Math.max(1200, 1800 - score * 5);
    moleTimeoutRef.current = setTimeout(() => {
      setActiveMoleIndex(null);
      if (isPlaying) setTimeout(spawnMole, 400);
    }, stayTime);
  }, [isPlaying, generateQuestion, score]);

  const startGame = () => {
    setScore(0);
    setTimeLeft(30);
    setIsPlaying(true);
    setShowModal(false);
    setIsSubmitted(false);
    setFeedback(null);
    setActiveMoleIndex(null);
  };

  // 倒數計時處理
  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      setActiveMoleIndex(null);
      setShowModal(true);
      clearInterval(timerRef.current);
      clearTimeout(moleTimeoutRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, timeLeft]);

  useEffect(() => {
    if (isPlaying) spawnMole();
  }, [isPlaying]);

  const handleAnswer = (choice) => {
    if (!isPlaying || activeMoleIndex === null) return;
    if (choice === currentQuestion.answer) {
      setScore(s => s + 10);
      setFeedback('correct');
    } else {
      setScore(s => Math.max(0, s - 5));
      setFeedback('wrong');
    }
    setTimeout(() => setFeedback(null), 400);
    clearTimeout(moleTimeoutRef.current);
    setActiveMoleIndex(null);
    setTimeout(spawnMole, 300);
  };

  const submitScore = async () => {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const scoresRef = collection(db, 'leaderboard');
      await addDoc(scoresRef, {
        name: playerName.trim() || '無名英雄',
        score: score,
        timestamp: Date.now(),
        uid: user.uid
      });
      setIsSubmitted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 以下 UI 部分與原本完全相同 ---
  return (
    <div className={`min-h-screen bg-green-500 flex flex-col items-center p-4 transition-colors duration-300 ${feedback === 'correct' ? 'bg-green-400' : feedback === 'wrong' ? 'bg-red-400' : ''}`}>
      
      {/* 頂部數據面板 */}
      <div className="w-full max-w-2xl bg-green-700 rounded-3xl p-5 shadow-2xl flex justify-between items-center mb-6 border-b-4 border-green-900">
        <div className="text-white text-center px-4">
          <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Score</p>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
            <span className="text-4xl font-black">{score}</span>
          </div>
        </div>
        
        <div className="hidden md:block">
            <h1 className="text-2xl font-bold text-white tracking-tighter">九九乘法大挑戰</h1>
        </div>

        <div className="text-white text-center px-4">
          <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Time</p>
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-yellow-300'}`} />
            <span className={`text-4xl font-black ${timeLeft < 10 ? 'text-red-400' : 'text-yellow-300'}`}>{timeLeft}s</span>
          </div>
        </div>
      </div>

      {/* 遊戲區域 */}
      <div className="relative w-full max-w-2xl bg-green-400 p-6 rounded-[3rem] shadow-inner border-4 border-green-300 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 relative z-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="relative aspect-square rounded-full bg-[#4b3621] shadow-[inset_0_8px_16px_rgba(0,0,0,0.6)] overflow-hidden border-b-8 border-amber-950">
              <div className={`absolute inset-0 flex flex-col items-center justify-center transition-transform duration-300 ${activeMoleIndex === i ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="w-4/5 h-4/5 bg-orange-700 rounded-t-full border-2 border-orange-900 shadow-lg flex flex-col items-center justify-center p-2">
                    <div className="flex gap-2 mb-2">
                        <div className="w-2 h-2 bg-black rounded-full" />
                        <div className="w-2 h-2 bg-black rounded-full" />
                    </div>
                    <div className="bg-white/90 px-3 py-1 rounded-xl shadow-inner scale-90 md:scale-100">
                        <span className="text-xl md:text-2xl font-black text-gray-800">{activeMoleIndex === i ? currentQuestion.text : ''}</span>
                    </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 開始遮罩 */}
        {!isPlaying && !showModal && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm rounded-[3rem] p-6 text-center">
            <button 
              onClick={startGame}
              className="bg-yellow-400 hover:bg-yellow-300 text-brown-900 font-black py-6 px-14 rounded-full text-4xl shadow-2xl transform transition hover:scale-105 active:scale-95 border-b-8 border-yellow-600 mb-8 flex items-center gap-3"
            >
              <Play className="w-10 h-10 fill-current" /> 開始挑戰
            </button>
            <div className="bg-white/95 p-5 rounded-3xl shadow-xl w-full max-w-xs">
              <h3 className="text-green-700 font-black text-xl mb-3 flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5" /> 排行榜 TOP 5
              </h3>
              <div className="space-y-2">
                {leaderboard.length > 0 ? leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-gray-100 pb-1">
                    <span className="font-bold text-gray-500 w-5">{i+1}.</span>
                    <span className="flex-grow text-left truncate px-2 font-medium">{entry.name}</span>
                    <span className="font-black text-orange-500">{entry.score}</span>
                  </div>
                )) : <p className="text-gray-400 py-4">正在載入高手數據...</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 答案按鈕 */}
      <div className="w-full max-w-2xl mt-8 grid grid-cols-3 gap-4">
        {currentQuestion.options.map((opt, i) => (
          <button
            key={i}
            disabled={!isPlaying || activeMoleIndex === null}
            onClick={() => handleAnswer(opt)}
            className="group relative bg-white disabled:opacity-50 disabled:scale-100 hover:bg-blue-50 text-blue-600 text-4xl font-black py-8 rounded-[2rem] shadow-xl transform transition hover:scale-105 active:scale-95 border-b-8 border-blue-200"
          >
            {opt}
            <div className="absolute -top-2 -right-2 bg-yellow-400 w-8 h-8 rounded-full flex items-center justify-center text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Zap className="w-4 h-4 fill-current" />
            </div>
          </button>
        ))}
      </div>

      {/* 遊戲結束 Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className={`bg-white rounded-[3rem] p-8 max-w-md w-full text-center shadow-2xl transition-all duration-500 ${showModal ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-4xl font-black text-green-600 mb-2">挑戰結束！</h2>
            
            <div className="bg-green-50 rounded-3xl py-6 my-6 border-2 border-green-100">
              <p className="text-gray-500 text-sm font-bold tracking-widest mb-1">YOUR SCORE</p>
              <p className="text-7xl font-black text-green-700 tracking-tighter">{score}</p>
            </div>

            {!isSubmitted ? (
              <div className="space-y-4 mb-6">
                <input 
                  type="text" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="輸入大名挑戰高手" 
                  maxLength={12}
                  className="w-full p-4 border-2 border-green-100 rounded-2xl text-center text-xl font-bold focus:outline-none focus:border-green-400 transition-colors"
                />
                <button 
                  onClick={submitScore}
                  disabled={isSubmitting}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl text-xl shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="animate-spin" /> : <Send />} {isSubmitting ? '正在傳送...' : '上傳成績至排行榜'}
                </button>
              </div>
            ) : (
              <div className="mb-8 p-4 bg-blue-50 rounded-2xl text-blue-700 font-bold flex flex-col items-center gap-2">
                 <p className="text-lg">成績上傳成功！🏅</p>
                 <div className="w-full max-h-40 overflow-y-auto pr-2 custom-scrollbar text-sm space-y-1">
                    {leaderboard.map((e, idx) => (
                        <div key={idx} className="flex justify-between border-b border-blue-100 py-1">
                            <span>{idx+1}. {e.name}</span>
                            <span>{e.score}</span>
                        </div>
                    ))}
                 </div>
              </div>
            )}

            <button 
              onClick={startGame}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-5 rounded-full text-2xl shadow-lg transform transition hover:scale-105"
            >
              再戰一回
            </button>
          </div>
        </div>
      )}
    </div>
  );
}