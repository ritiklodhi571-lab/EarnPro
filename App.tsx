import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, TaskCategory, TaskStatus, UserTask, UserProfile, WalletState, Withdrawal } from './types';
import { APP_CONFIG } from './constants';
import TaskCard from './components/TaskCard';
import Toast from './components/Toast';
import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  collection,
  query,
  where,
  addDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  doc,
  setDoc
} from './firebase';

const App: React.FC = () => {
  // Navigation & UI State
  const [currentPage, setCurrentPage] = useState<'login' | 'signup' | 'forgot-password' | 'home' | 'history' | 'wallet' | 'profile'>('login');
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>(TaskCategory.ALL);
  const [sortOrder, setSortOrder] = useState<'h-l' | 'l-h' | 'mid' | 'none'>('none');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  // Business State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [userMessages, setUserMessages] = useState<any[]>([]);
  const [savedTaskIds, setSavedTaskIds] = useState<Set<string>>(new Set());
  const [fileSelected, setFileSelected] = useState<boolean>(false);

  // Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [withdrawUpi, setWithdrawUpi] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'Paytm' | 'PhonePe' | 'Google Pay' | ''>('');

  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          name: 'Loading...',
          email: firebaseUser.email || '',
          userId: firebaseUser.uid
        });
        setCurrentPage('home');
      } else {
        setUser(null);
        setCurrentPage('login');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Firestore Listeners
  useEffect(() => {
    if (!user) return;

    const tasksQuery = query(collection(db, 'tasks'), where('status', '==', 'active'));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      const taskList: Task[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(taskList);
    });

    const subQuery = query(collection(db, 'task_submissions'), where('uid', '==', user.userId));
    const unsubSubs = onSnapshot(subQuery, (snapshot) => {
      setSubmissions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const withdrawQuery = query(collection(db, 'withdrawal_requests'), where('uid', '==', user.userId));
    const unsubWithdraw = onSnapshot(withdrawQuery, (snapshot) => {
      const history: Withdrawal[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          amount: data.amount,
          upiId: data.upiId,
          method: data.method,
          status: data.status,
          date: data.requestedAt?.toDate()?.toLocaleDateString() || 'Recently',
          requestedAtRaw: data.requestedAt?.toDate()?.getTime() || 0
        };
      });
      // Client-side sorting
      history.sort((a: any, b: any) => b.requestedAtRaw - a.requestedAtRaw);
      setWithdrawals(history);
    });

    const unsubUser = onSnapshot(doc(db, 'users', user.userId), (d) => {
      if (d.exists()) {
        const data = d.data();
        setUser(prev => prev ? { ...prev, name: data.name, email: data.email } : null);
      }
    });

    const msgQuery = query(collection(db, 'user_messages'), where('uid', '==', user.userId));
    const unsubMsgs = onSnapshot(msgQuery, (snapshot) => {
      const msgs = snapshot.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          createdAtRaw: data.createdAt?.toDate()?.getTime() || 0 
        };
      });
      // Client-side sorting
      msgs.sort((a, b) => b.createdAtRaw - a.createdAtRaw);
      setUserMessages(msgs);
    });

    return () => {
      unsubTasks();
      unsubSubs();
      unsubWithdraw();
      unsubUser();
      unsubMsgs();
    };
  }, [user?.userId]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derive Stats and Wallet
  const stats = useMemo(() => ({
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
    pendingAmt: submissions.filter(s => s.status === 'pending').reduce((acc, curr) => acc + (curr.reward || 0), 0),
    withdrawableAmt: submissions.filter(s => s.status === 'approved').reduce((acc, curr) => acc + (curr.reward || 0), 0)
  }), [submissions]);

  // Auth Functions
  const handleLogin = async () => {
    if (!loginEmail || !loginPass) return showToast('Fill all fields', 'error');
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      showToast('Welcome back!', 'success');
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const handleSignup = async () => {
    if (!signupName || !signupEmail || !signupPass) return showToast('Fill all fields', 'error');
    try {
      const res = await createUserWithEmailAndPassword(auth, signupEmail, signupPass);
      await setDoc(doc(db, 'users', res.user.uid), {
        name: signupName,
        email: signupEmail,
        createdAt: serverTimestamp()
      });
      showToast('Account Created!', 'success');
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const handleReset = async () => {
    if (!resetEmail) return showToast('Enter email', 'error');
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      showToast('Reset link sent!', 'success');
      setCurrentPage('login');
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const submitTask = async () => {
    if (!activeTask || !user) return;
    try {
      const screenshotUrl = "https://via.placeholder.com/300"; 
      await addDoc(collection(db, 'task_submissions'), {
        uid: user.userId,
        taskId: activeTask.id,
        taskTitle: activeTask.title,
        category: activeTask.category,
        reward: activeTask.price,
        screenshotUrl,
        status: 'pending',
        submittedAt: serverTimestamp()
      });
      showToast('Submitted for approval!', 'success');
      closeTaskModal();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const requestWithdrawal = async () => {
    if (!user) return;
    const rawAmt = Number(withdrawAmount);
    
    // Check if fields are filled
    if (!withdrawMethod || !withdrawUpi) {
      return showToast('Select Method and Enter UPI ID', 'error');
    }

    // Integer validation (Only whole numbers like 20, 34, 56)
    if (!Number.isInteger(rawAmt)) {
      return showToast('Enter whole numbers only (e.g. 25, 50)', 'error');
    }

    // Range validation: 20 - 500
    if (rawAmt < APP_CONFIG.MIN_WITHDRAWAL || rawAmt > APP_CONFIG.MAX_WITHDRAWAL) {
      return showToast(`Limit: ₹${APP_CONFIG.MIN_WITHDRAWAL} - ₹${APP_CONFIG.MAX_WITHDRAWAL}`, 'error');
    }

    // Balance validation
    if (rawAmt > stats.withdrawableAmt) {
      return showToast('Insufficient balance', 'error');
    }

    try {
      await addDoc(collection(db, 'withdrawal_requests'), {
        uid: user.userId,
        amount: rawAmt,
        method: withdrawMethod,
        upiId: withdrawUpi,
        status: 'pending',
        requestedAt: serverTimestamp()
      });
      setWithdrawAmount('');
      showToast('Withdrawal Requested!', 'success');
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const filteredTasks = useMemo(() => {
    let list = [...tasks];
    if (selectedCategory === TaskCategory.SAVE) list = list.filter(t => savedTaskIds.has(t.id));
    else if (selectedCategory !== TaskCategory.ALL) list = list.filter(t => t.category === selectedCategory);
    
    if (sortOrder === 'h-l') list.sort((a, b) => b.price - a.price);
    else if (sortOrder === 'l-h') list.sort((a, b) => a.price - b.price);
    else if (sortOrder === 'mid') {
        list.sort((a, b) => {
            const isAMid = a.price >= 10 && a.price <= 50;
            const isBMid = b.price >= 10 && b.price <= 50;
            if (isAMid && !isBMid) return -1;
            if (!isAMid && isBMid) return 1;
            return b.price - a.price;
        });
    }
    return list;
  }, [selectedCategory, sortOrder, savedTaskIds, tasks]);

  const openTaskModal = (task: Task) => { setActiveTask(task); setIsTaskModalOpen(true); setFileSelected(false); };
  const closeTaskModal = () => { setIsTaskModalOpen(false); setActiveTask(null); };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-white"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (currentPage === 'login') {
    return (
      <div className="h-screen flex flex-col justify-center p-8 bg-white max-w-md mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-blue-600 tracking-tighter">EarnPro</h1>
          <p className="text-slate-400 font-medium">Daily Cash Companion</p>
        </div>
        <div className="space-y-4">
          <input type="email" placeholder="Email Address" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/10 font-semibold" />
          <input type="password" placeholder="Password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/10 font-semibold" />
          <button onClick={() => setCurrentPage('forgot-password')} className="text-[10px] font-black text-blue-600 uppercase w-full text-right pr-2">Forgot Password?</button>
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-4 rounded-3xl shadow-xl shadow-blue-200 active:scale-95 transition-all">Login</button>
          <p className="text-center text-sm text-slate-500">New here? <button onClick={() => setCurrentPage('signup')} className="text-blue-600 font-black">Create Account</button></p>
        </div>
      </div>
    );
  }

  if (currentPage === 'signup') {
    return (
      <div className="h-screen flex flex-col justify-center p-8 bg-white max-w-md mx-auto">
        <h1 className="text-3xl font-black text-slate-800 mb-2">Join EarnPro</h1>
        <p className="text-slate-500 mb-8 font-medium">Start earning today.</p>
        <div className="space-y-4">
          <input placeholder="Full Name" value={signupName} onChange={(e) => setSignupName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-semibold" />
          <input placeholder="Email Address" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-semibold" />
          <input type="password" placeholder="Password" value={signupPass} onChange={(e) => setSignupPass(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-semibold" />
          <button onClick={handleSignup} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl active:scale-95 transition-all">Create Account</button>
          <p className="text-center text-sm text-slate-500">Have account? <button onClick={() => setCurrentPage('login')} className="text-blue-600 font-bold">Login</button></p>
        </div>
      </div>
    );
  }

  if (currentPage === 'forgot-password') {
    return (
      <div className="h-screen flex flex-col justify-center p-8 bg-white max-w-md mx-auto">
        <h1 className="text-3xl font-black text-slate-800 mb-2">Reset Password</h1>
        <p className="text-slate-500 mb-8 font-medium">Enter registered email.</p>
        <div className="space-y-4">
          <input type="email" placeholder="Email Address" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-semibold" />
          <button onClick={handleReset} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl active:scale-95 transition-all">Send Link</button>
          <button onClick={() => setCurrentPage('login')} className="w-full text-slate-400 font-black text-[10px] uppercase">Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 relative overflow-hidden">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex justify-between items-center sticky top-0 z-40">
        <span className="font-black text-blue-600 text-xl tracking-tighter">EarnPro</span>
        <div className="flex items-center gap-2">
          <div className="bg-orange-500/10 text-orange-600 px-3 py-1.5 rounded-2xl flex flex-col items-center min-w-[70px]">
            <span className="text-[8px] uppercase font-black tracking-tighter">Pending</span>
            <span id="pending-count" className="text-xs font-black">{stats.pending}</span>
          </div>
          <div className="bg-green-500/10 text-green-600 px-3 py-1.5 rounded-2xl flex flex-col items-center min-w-[70px]">
            <span className="text-[8px] uppercase font-black tracking-tighter">Approve</span>
            <span id="approve-count" className="text-xs font-black">{stats.approved}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {currentPage === 'home' && (
          <div className="p-4 space-y-6">
            <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Welcome, {user?.name}!</h2><p className="text-blue-600 text-sm font-black uppercase tracking-wider">Earn Real Cash Daily! 🚀</p></div>
            
            <div className="sticky top-0 bg-slate-50/90 backdrop-blur-md py-2 z-30 flex items-center gap-2">
              <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                {[TaskCategory.ALL, TaskCategory.INSTALL, TaskCategory.GAMES, TaskCategory.SIGNUP, TaskCategory.OTHERS, TaskCategory.SAVE].map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>{cat}</button>
                ))}
              </div>
              
              <div className="relative" ref={sortDropdownRef}>
                <button 
                  onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                  className="bg-white border border-slate-100 p-2.5 rounded-full shadow-sm text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isSortDropdownOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                </button>
                
                {isSortDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-slide-up origin-top-right">
                    <button onClick={() => { setSortOrder('h-l'); setIsSortDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold ${sortOrder === 'h-l' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}>Price: High to Low</button>
                    <button onClick={() => { setSortOrder('l-h'); setIsSortDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold ${sortOrder === 'l-h' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}>Price: Low to High</button>
                    <button onClick={() => { setSortOrder('mid'); setIsSortDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold ${sortOrder === 'mid' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}>Medium Range</button>
                    <button onClick={() => { setSortOrder('none'); setIsSortDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold border-t border-slate-50 ${sortOrder === 'none' ? 'text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>Reset Sorting</button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {filteredTasks.length > 0 ? filteredTasks.map(task => {
                const sub = submissions.find(s => s.taskId === task.id);
                return <TaskCard key={task.id} task={task} status={sub?.status} isSaved={savedTaskIds.has(task.id)} onToggleSave={(id) => setSavedTaskIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })} onClick={openTaskModal} />;
              }) : <div className="text-center py-20 opacity-20"><p className="font-bold">No tasks found</p></div>}
            </div>
          </div>
        )}

        {currentPage === 'history' && (
          <div className="p-6">
            <h3 className="text-2xl font-black text-slate-800 mb-6">Transactions</h3>
            <div className="space-y-4">
              {withdrawals.length === 0 ? <div className="text-center py-20 opacity-20"><p className="font-bold">No History</p></div> : withdrawals.map(w => (
                <div key={w.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                  <div><p className="text-sm font-black text-slate-800">{APP_CONFIG.CURRENCY_SYMBOL}{w.amount}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{w.method} • {w.upiId}</p></div>
                  <div className="text-right"><p className="text-[9px] text-slate-400 font-bold uppercase">{w.date}</p><span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${w.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{w.status}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPage === 'wallet' && (
          <div className="p-6 space-y-8">
            <h3 className="text-2xl font-black text-slate-800">Earnings</h3>
            <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative">
              <div className="flex justify-between">
                 <div><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">In Review</p><h4 className="text-4xl font-black text-orange-400">{APP_CONFIG.CURRENCY_SYMBOL}{stats.pendingAmt}</h4></div>
                 <div className="text-right"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Available</p><h4 className="text-4xl font-black text-green-400">{APP_CONFIG.CURRENCY_SYMBOL}{stats.withdrawableAmt}</h4></div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center"><p className="text-[11px] font-bold text-blue-300 uppercase tracking-widest bg-blue-500/10 px-5 py-2 rounded-full">approval progress within 12 hours</p></div>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5">
              <div className="flex justify-between items-center px-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</label>
                 <select value={withdrawMethod} onChange={(e) => setWithdrawMethod(e.target.value as any)} className="text-xs font-black text-blue-600 uppercase bg-blue-50 px-5 py-2 rounded-xl outline-none"><option value="">Select</option><option value="Paytm">Paytm</option><option value="PhonePe">PhonePe</option><option value="Google Pay">Google Pay</option></select>
              </div>
              <input type="text" placeholder="yourname@upi" value={withdrawUpi} onChange={(e) => setWithdrawUpi(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" />
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                    <span>Amount</span>
                    <span className="text-blue-500 lowercase">(mini ₹20 max ₹500)</span>
                </label>
                <input type="number" step="1" placeholder="0.00" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full mt-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-xl text-blue-600" />
              </div>
              <button onClick={requestWithdrawal} className="w-full bg-blue-600 text-white font-black py-4 rounded-3xl shadow-xl active:scale-95 transition-all">Withdraw Now</button>
            </div>
          </div>
        )}

        {currentPage === 'profile' && (
          <div className="p-8 text-center space-y-6">
            <div className="w-28 h-28 bg-blue-100 rounded-[2.5rem] mx-auto flex items-center justify-center text-blue-600 border-8 border-white shadow-xl"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <div>
              <h4 id="profile-name" className="text-2xl font-black text-slate-800 leading-tight">{user?.name}</h4>
              <p id="profile-email" className="text-slate-400 font-semibold text-sm">{user?.email}</p>
              <div className="mt-2"><span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.1em] bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">User ID: {user?.userId.substring(0, 12)}...</span></div>
            </div>
            
            {userMessages.length > 0 && (
              <div className="bg-blue-50/50 p-4 rounded-3xl text-left">
                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-2 px-1">System Alerts</p>
                <div className="space-y-2">
                  {userMessages.slice(0, 3).map(m => (
                    <div key={m.id} className="bg-white p-3 rounded-xl border border-blue-100 text-xs font-semibold text-slate-600">{m.text}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100"><span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Rejected</span><p id="reject-count" className="text-xl font-black text-rose-600">{stats.rejected}</p></div>
               <div className="bg-green-50 p-4 rounded-3xl border border-green-100"><span className="text-[8px] font-black text-green-400 uppercase tracking-widest">Payouts</span><p className="text-xl font-black text-green-600">₹{withdrawals.filter(w => w.status === 'success').reduce((a,c) => a+c.amount, 0)}</p></div>
            </div>

            <div className="space-y-3 pt-4">
              <button onClick={() => window.open(APP_CONFIG.SUPPORT_URL, '_blank')} className="w-full py-4 bg-white border border-slate-100 rounded-2xl font-black text-slate-700 flex items-center justify-center gap-3 active:scale-95 shadow-sm">Help & Support</button>
              <button onClick={() => signOut(auth)} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-rose-100 active:scale-95">Logout Account</button>
            </div>
            <div className="pt-12 flex flex-col items-center">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">EarnPro v2.0</p>
              <p className="text-[11px] font-black uppercase mt-1 tracking-wider text-slate-900">Powered by <span className="text-[#FFD700] font-black">BOOSTGALAXY</span></p>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t flex justify-around items-center h-20 z-50 px-4 rounded-t-[2.5rem] shadow-lg">
        {[
            { id: 'home', label: 'Home', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
            { id: 'history', label: 'History', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg> },
            { id: 'wallet', label: 'Wallet', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
            { id: 'profile', label: 'Profile', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
        ].map(item => (
          <button 
            key={item.id} 
            onClick={() => setCurrentPage(item.id as any)} 
            className={`flex flex-col items-center justify-center w-16 h-16 transition-all ${currentPage === item.id ? 'text-blue-600 -translate-y-1' : 'text-slate-300'}`}
          >
            {item.icon}
            <span className="text-[10px] font-black uppercase tracking-tight mt-1">{item.label}</span>
          </button>
        ))}
      </nav>

      {isTaskModalOpen && activeTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end justify-center animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] p-8 shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-slate-800 tracking-tight">Earning Task</h2><button onClick={closeTaskModal} className="bg-slate-50 p-2 rounded-full text-slate-400">X</button></div>
            <div className="w-full h-48 rounded-[2.5rem] overflow-hidden mb-6 bg-slate-100"><img src={activeTask.imageUrl} alt={activeTask.title} className="w-full h-full object-cover" /></div>
            <div className="space-y-6">
               <h3 className="text-xl font-black text-slate-800">{activeTask.title}</h3>
               <p className="text-sm text-slate-600 font-medium leading-relaxed">{activeTask.description}</p>
               <div className="bg-blue-50 p-6 rounded-[2.5rem] flex justify-between items-center">
                  <div><span className="text-[9px] font-black text-blue-500 uppercase">Payout</span><p className="text-2xl font-black text-blue-700">₹{activeTask.price}</p></div>
                  <button className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs">{activeTask.actionText}</button>
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Screenshot Proof</label>
                  <input type="file" onChange={(e) => setFileSelected(!!e.target.files?.length)} className="w-full text-xs font-bold text-slate-500 file:bg-blue-600 file:text-white file:border-0 file:rounded-full file:px-4 file:py-2 cursor-pointer" />
               </div>
               <button onClick={submitTask} disabled={!fileSelected} className={`w-full py-4 rounded-3xl font-black text-sm shadow-xl transition-all ${fileSelected ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-300'}`}>Submit Proof</button>
            </div>
          </div>
        </div>
      )}

      <Toast isVisible={toast.isVisible} message={toast.message} type={toast.type} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} />
    </div>
  );
};

export default App;