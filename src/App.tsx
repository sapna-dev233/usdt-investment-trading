/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  LayoutDashboard, 
  History, 
  ShieldCheck, 
  LogOut, 
  PieChart, 
  RefreshCcw,
  Zap,
  Globe,
  DollarSign,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { auth, db } from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  updateDoc,
  increment,
  limit
} from 'firebase/firestore';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Ticker = () => {
  const [prices, setPrices] = useState<any>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,binancecoin,solana&vs_currencies=usd");
        const data = await res.json();
        setPrices(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!prices) return <div className="h-6 bg-lime-400 animate-pulse" />;

  return (
    <footer className="bg-lime-400 text-black py-2 overflow-hidden whitespace-nowrap border-t border-black sticky bottom-0 z-50">
      <motion.div 
        animate={{ x: [0, -1000] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="inline-block text-[11px] font-black uppercase tracking-tighter"
      >
        <span>BTC: ${prices.bitcoin.usd.toLocaleString()} | </span>
        <span>ETH: ${prices.ethereum.usd.toLocaleString()} | </span>
        <span>BNB: ${prices.binancecoin.usd.toLocaleString()} | </span>
        <span>SOL: ${prices.solana.usd.toLocaleString()} | </span>
        <span>USDT: ${prices.tether.usd.toFixed(4)} | </span>
        <span>BTC: ${prices.bitcoin.usd.toLocaleString()} | </span>
        <span>ETH: ${prices.ethereum.usd.toLocaleString()} | </span>
        <span>BNB: ${prices.binancecoin.usd.toLocaleString()} | </span>
        <span>SOL: ${prices.solana.usd.toLocaleString()} | </span>
        <span>USDT: ${prices.tether.usd.toFixed(4)} | </span>
      </motion.div>
    </footer>
  );
};

const TradingViewWidget = ({ symbol = "BINANCE:BTCUSDT" }: { symbol?: string }) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      new window.TradingView.widget({
        "width": "100%",
        "height": 450,
        "symbol": symbol,
        "interval": "15",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#0f172a",
        "enable_publishing": false,
        "hide_top_toolbar": false,
        "save_image": false,
        "container_id": "tradingview_chart"
      });
    };
    document.head.appendChild(script);
  }, [symbol]);

  return <div id="tradingview_chart" className="rounded-xl overflow-hidden border border-white/5" />;
};

const MarketTable = () => {
  const [marketData, setMarketData] = useState<any[]>([]);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false");
        const data = await res.json();
        setMarketData(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMarket();
    const interval = setInterval(fetchMarket, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-10 bg-[#0a0a0a]">
      <div className="flex justify-between items-end mb-8">
        <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase opacity-50">Market Intelligence</h3>
        <div className="flex items-center gap-2 text-[10px] font-bold text-lime-400">
          <span className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></span> LIVE DATA FEED
        </div>
      </div>
      
      <div className="w-full space-y-1">
        <div className="grid grid-cols-4 text-[10px] font-bold tracking-widest text-white/30 uppercase pb-4">
          <div>Asset</div>
          <div>Price</div>
          <div>24h Chg</div>
          <div className="text-right">Action</div>
        </div>
        
        {marketData.map((coin) => (
          <div key={coin.id} className="grid grid-cols-4 py-4 border-b border-white/5 items-center font-bold italic">
            <div className="flex items-center gap-3">
              <span className="text-lg uppercase">{coin.symbol}</span>
            </div>
            <div className="text-lg">${coin.current_price.toLocaleString()}</div>
            <div className={coin.price_change_percentage_24h > 0 ? "text-lime-400" : "text-rose-500"}>
              {coin.price_change_percentage_24h > 0 ? "+" : ""}{coin.price_change_percentage_24h.toFixed(2)}%
            </div>
            <div className="flex justify-end">
              <button className="text-[10px] uppercase border border-white/20 px-2 py-1 hover:bg-white hover:text-black transition-all">Trade</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Header = () => {
  const { user, userData } = useAuth();
  
  return (
    <nav className="flex justify-between items-center px-10 py-6 border-b border-white/10 bg-[#050505]">
      <div className="text-2xl font-black tracking-tighter flex items-center gap-2 uppercase">
        <div className="w-6 h-6 bg-lime-400 rounded-full"></div>
        USDT.ALPHA
      </div>
      <div className="hidden md:flex gap-8 text-[11px] font-bold tracking-[0.2em] uppercase text-white/50">
        <a href="#" className="text-white">Terminal</a>
        <a href="#" className="hover:text-white transition-colors">Markets</a>
        <a href="#" className="hover:text-white transition-colors">Invest</a>
        <a href="#" className="hover:text-white transition-colors">History</a>
      </div>
      <div className="flex items-center gap-4">
        <div className="bg-white text-black px-4 py-2 text-[11px] font-black uppercase">
          {userData?.wallet ? `${userData.wallet.slice(0, 6)}...${userData.wallet.slice(-5)}` : "CONNECTED"}
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="p-2 text-white/50 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};

// --- Main App Content ---

const LandingPage = ({ setView }: { setView: (v: 'login' | 'register') => void }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Ticker />
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">Verified Smart Contracts</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6">
            The Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">USDT Yield</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto">
            Secure, automated, and high-performance investment engine. Earn up to 1.5% daily with instant BEP20 tracking.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setView('register')}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
            >
              Get Started Now
            </button>
            <button 
              onClick={() => setView('login')}
              className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all"
            >
              Member Login
            </button>
          </div>
        </motion.div>
      </div>
      <footer className="py-8 border-t border-white/5 text-center text-[10px] text-slate-600 font-mono uppercase tracking-[0.2em]">
        Alpha Yield Systems &copy; 2026 | All Rights Reserved
      </footer>
    </div>
  );
};

const AuthForm = ({ type }: { type: 'login' | 'register' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [wallet, setWallet] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (type === 'register') {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', res.user.uid), {
          email,
          wallet: wallet.toLowerCase(),
          balance: 0,
          totalEarned: 0,
          createdAt: serverTimestamp(),
          isAdmin: false
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <div className="mb-8 text-center">
          <Zap className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">{type === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-slate-500 text-sm">{type === 'login' ? 'Enter your credentials to access the terminal' : 'Join the Alpha Yield network today'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] text-slate-500 font-mono uppercase mb-2 block">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
              placeholder="operator@alpha.systems"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-mono uppercase mb-2 block">Secret Key</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          {type === 'register' && (
            <div>
              <label className="text-[10px] text-slate-500 font-mono uppercase mb-2 block">BEP20 USDT Wallet (For Deposits)</label>
              <input 
                type="text" 
                required
                value={wallet}
                onChange={e => setWallet(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
                placeholder="0x..."
              />
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all mt-4 disabled:opacity-50"
          >
            {loading ? 'Processing...' : type === 'login' ? 'Authenticate' : 'Initalize Profile'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => window.location.href = type === 'login' ? '/?view=register' : '/?view=login'}
            className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
          >
            {type === 'login' ? "Don't have an account? Sign up" : "Already registered? Login here"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const { user, userData } = useAuth();
  const [investments, setInvestments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'invest' | 'wallet' | 'admin'>('overview');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'investments'), where('userEmail', '==', user.email));
    return onSnapshot(q, (snap) => {
      setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  const plans = [
    { name: "BASIC", min: 10, daily: 1.0, duration: 30, color: "hover:bg-lime-400" },
    { name: "STANDARD", min: 50, daily: 1.2, duration: 45, color: "hover:bg-white" },
    { name: "PREMIUM", min: 100, daily: 1.5, duration: 60, color: "hover:bg-emerald-400" },
  ];

  const handleInvest = async (plan: any) => {
    if (!userData || userData.balance < plan.min) {
      alert("Insufficient balance for this plan.");
      return;
    }

    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', user!.uid), {
        balance: increment(-plan.min)
      });

      await addDoc(collection(db, 'investments'), {
        userEmail: user!.email,
        planName: plan.name,
        amount: plan.min,
        dailyProfit: plan.daily,
        duration: plan.duration,
        startDate: serverTimestamp(),
        lastPaid: serverTimestamp(),
        totalEarned: 0,
        status: 'active'
      });
      alert("Investment successfully activated!");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!userData || isNaN(amt) || amt < 10 || amt > userData.balance) {
      alert("Invalid amount or insufficient balance (Min withdrawal 10 USDT)");
      return;
    }

    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', user!.uid), {
        balance: increment(-amt)
      });

      await addDoc(collection(db, 'withdrawals'), {
        userEmail: user!.email,
        amount: amt,
        walletAddress: userData.wallet,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setWithdrawAmount('');
      alert("Withdrawal request submitted.");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* HERO BALANCE SECTION */}
        <section className="px-10 py-12 flex flex-col border-b border-white/10">
          <span className="text-lime-400 text-[11px] font-bold tracking-[0.3em] uppercase mb-2">Available Liquidity</span>
          <div className="flex items-baseline gap-4">
            <h1 className="text-[80px] md:text-[140px] font-black tracking-tighter leading-[0.85] italic">
              {userData?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
            </h1>
            <span className="text-3xl md:text-5xl font-black italic text-white/30">USDT</span>
          </div>
          <div className="flex flex-wrap gap-12 mt-8">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Total Profit</p>
              <p className="text-2xl font-bold text-lime-400">+{userData?.totalEarned?.toFixed(2) || "0.00"} <span className="text-xs font-medium ml-1 opacity-70">USDT</span></p>
            </div>
            <div className="border-l border-white/10 pl-12">
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Active Stakes</p>
              <p className="text-2xl font-bold italic">${investments.reduce((acc, current) => acc + (current.status === 'active' ? current.amount : 0), 0).toFixed(2)}</p>
            </div>
            <div className="border-l border-white/10 pl-12">
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Session Status</p>
              <p className="text-2xl font-bold italic text-white/80">ONLINE</p>
            </div>
          </div>
        </section>

        {/* GRID LAYOUT */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* LEFT: INVESTMENT & DEPOSIT */}
          <div className="lg:col-span-5 border-r border-white/10 p-10 overflow-y-auto">
            <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase mb-8 opacity-50">Selection Modules</h3>
            <div className="space-y-4 mb-12">
              {plans.map((p) => (
                <div 
                  key={p.name}
                  onClick={() => handleInvest(p)}
                  className={cn(
                    "group bg-white/5 border border-white/10 p-6 flex justify-between items-center transition-all cursor-pointer",
                    p.color, "hover:text-black"
                  )}
                >
                  <div>
                    <h4 className="text-2xl font-black italic uppercase">{p.name}</h4>
                    <p className="text-[10px] uppercase opacity-60 font-bold group-hover:text-black">Daily Yield: {p.daily}% • Min {p.min} USDT</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black uppercase border border-current px-2 py-1">Stake</span>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase mb-8 opacity-50">Wallet Interaction</h3>
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 p-6">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">Deposit Network (BEP20)</p>
                <p className="text-xs font-mono text-lime-400 break-all select-all">0xf2963E2fFC0E9372E0Ca6E9C73B0a4D19198C0DF</p>
              </div>

              <form onSubmit={handleWithdraw} className="space-y-4">
                <input 
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="WITHDRAW AMOUNT"
                  className="w-full bg-white/5 border border-white/10 p-4 text-white font-black italic outline-none focus:border-white"
                />
                <button className="w-full bg-white text-black p-4 font-black uppercase tracking-widest hover:bg-lime-400 transition-all">Execute Payout</button>
              </form>
            </div>
          </div>

          {/* RIGHT: LIVE MARKET VIEW */}
          <div className="lg:col-span-7 bg-[#0a0a0a] overflow-y-auto">
            <MarketTable />
            
            <div className="p-10 pt-0 space-y-6">
              <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase opacity-50 mb-4">Visual Terminal</h3>
              <TradingViewWidget />

              <div className="mt-10 bg-white/5 p-6 border border-dashed border-white/20 rounded-sm">
                 <div className="flex justify-between">
                   <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Protocol Status</p>
                   <p className="text-[10px] font-bold text-lime-400 uppercase tracking-widest">Connected</p>
                 </div>
                 <p className="text-xs font-mono mt-2 text-white/70">ALPHA ENGINE V2.04 RUNNING STABLE</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Ticker />
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'landing' | 'login' | 'register'>('landing');

  // Handle URL params for easy navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v === 'login' || v === 'register') setView(v);
  }, []);

  return (
    <AuthProvider>
      <AppContent view={view} setView={setView} />
    </AuthProvider>
  );
}

function AppContent({ view, setView }: { view: any, setView: any }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Zap className="w-8 h-8 text-emerald-400 animate-pulse" />
        <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            animate={{ x: [-200, 200] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1/2 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          />
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  if (view === 'login') return <AuthForm type="login" />;
  if (view === 'register') return <AuthForm type="register" />;
  
  return <LandingPage setView={setView} />;
}
