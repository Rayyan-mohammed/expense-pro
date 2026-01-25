import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Transaction, 
  Account, 
  User, 
  TransactionType, 
  TransactionStatus, 
  PaymentMode,
  Comment,
  MemberRole,
  AccountMember
} from './types';
import { Icons } from './constants';
import { getFinancialInsights, draftInvitationEmail } from './services/geminiService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// --- Global Config ---
const CURRENCIES = [
  { code: 'INR', symbol: '₹', locale: 'en-IN' },
  { code: 'USD', symbol: '$', locale: 'en-US' },
  { code: 'EUR', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', locale: 'en-GB' },
];

// --- Helper Components ---

const Button: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'ai';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}> = ({ onClick, children, variant = 'primary', className = '', disabled, type = 'button' }) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
    ghost: "bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700",
    ai: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 shadow-md",
  };

  return (
    <button type={type} onClick={onClick} className={`${base} ${variants[variant]} ${className}`} disabled={disabled}>
      {children}
    </button>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-gray-100 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

const Badge: React.FC<{ status: TransactionStatus }> = ({ status }) => {
  const styles = {
    [TransactionStatus.PENDING]: "bg-amber-50 text-amber-700 border-amber-100",
    [TransactionStatus.APPROVED]: "bg-emerald-50 text-emerald-700 border-emerald-100",
    [TransactionStatus.REJECTED]: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${styles[status]}`}>
      {status}
    </span>
  );
};

const RoleBadge: React.FC<{ role: MemberRole }> = ({ role }) => {
  const styles = {
    [MemberRole.OWNER]: "bg-indigo-50 text-indigo-700 border-indigo-100",
    [MemberRole.EDITOR]: "bg-blue-50 text-blue-700 border-blue-100",
    [MemberRole.VIEWER]: "bg-gray-50 text-gray-600 border-gray-100",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight border ${styles[role]}`}>
      {role}
    </span>
  );
};

const PaymentBadge: React.FC<{ mode: PaymentMode }> = ({ mode }) => {
  const isOnline = mode === PaymentMode.ONLINE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${isOnline ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
      {isOnline ? <Icons.Online /> : <Icons.Cash />}
      {mode}
    </span>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('exppro_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('exppro_accounts');
    const data = saved ? JSON.parse(saved) : [];
    return data.map((acc: any) => ({
      ...acc,
      members: acc.members || (acc.sharedWith ? acc.sharedWith.map((uid: string) => ({ userId: uid, role: MemberRole.EDITOR })) : [])
    }));
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('exppro_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('exppro_all_users');
    return saved ? JSON.parse(saved) : [
      { id: 'u1', name: 'John Doe', email: 'john@example.com', password: 'password123', isAdmin: true },
      { id: 'u2', name: 'Jane Manager', email: 'jane@example.com', password: 'password123' },
      { id: 'u3', name: 'Bob Finance', email: 'bob@example.com', password: 'password123' },
    ];
  });
  const [currencyCode, setCurrencyCode] = useState(() => localStorage.getItem('exppro_currency') || 'INR');

  // Dashboard Filters State
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardAccountFilter, setDashboardAccountFilter] = useState('all');
  const [dashboardTypeFilter, setDashboardTypeFilter] = useState('all');
  const [dashboardModeFilter, setDashboardModeFilter] = useState('all');
  const [weekOffset, setWeekOffset] = useState(0); 

  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'sharing'>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(!currentUser);
  
  // Member Management State
  const [accountToManage, setAccountToManage] = useState<Account | null>(null);
  const [isEditMembersModalOpen, setIsEditMembersModalOpen] = useState(false);
  
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('exppro_user', JSON.stringify(currentUser));
    localStorage.setItem('exppro_accounts', JSON.stringify(accounts));
    localStorage.setItem('exppro_transactions', JSON.stringify(transactions));
    localStorage.setItem('exppro_all_users', JSON.stringify(users));
    localStorage.setItem('exppro_currency', currencyCode);
  }, [currentUser, accounts, transactions, users, currencyCode]);

  // --- Currency Helpers ---
  const currentCurrency = useMemo(() => CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0], [currencyCode]);
  
  const formatValue = useCallback((val: number) => {
    return new Intl.NumberFormat(currentCurrency.locale, {
      style: 'currency',
      currency: currentCurrency.code,
    }).format(val);
  }, [currentCurrency]);

  // --- Computed State ---
  const myAccounts = useMemo(() => {
    if (!currentUser) return [];
    return accounts.filter(a => a.ownerId === currentUser.id || a.members.some(m => m.userId === currentUser.id));
  }, [accounts, currentUser]);

  const selectedAccount = useMemo(() => 
    accounts.find(a => a.id === selectedAccountId), 
  [accounts, selectedAccountId]);

  const userPermissionInAccount = useMemo(() => {
    if (!currentUser || !selectedAccount) return MemberRole.VIEWER;
    if (selectedAccount.ownerId === currentUser.id) return MemberRole.OWNER;
    const member = selectedAccount.members.find(m => m.userId === currentUser.id);
    return member?.role || MemberRole.VIEWER;
  }, [currentUser, selectedAccount]);

  const canEditSelectedAccount = userPermissionInAccount === MemberRole.OWNER || userPermissionInAccount === MemberRole.EDITOR;

  const filteredTransactions = useMemo(() => {
    const targetAccountIds = selectedAccountId 
      ? [selectedAccountId] 
      : (dashboardAccountFilter === 'all' 
          ? myAccounts.map(a => a.id) 
          : [dashboardAccountFilter]);

    let txs = transactions.filter(t => targetAccountIds.includes(t.accountId));

    if (dashboardSearch.trim()) {
      const search = dashboardSearch.toLowerCase();
      txs = txs.filter(t => t.comment.toLowerCase().includes(search));
    }

    if (dashboardTypeFilter !== 'all') {
      txs = txs.filter(t => t.type === dashboardTypeFilter);
    }

    if (dashboardModeFilter !== 'all') {
      txs = txs.filter(t => t.paymentMode === dashboardModeFilter);
    }

    return txs.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.id.localeCompare(a.id);
    });
  }, [transactions, selectedAccountId, dashboardAccountFilter, dashboardSearch, dashboardTypeFilter, dashboardModeFilter, myAccounts]);

  const stats = useMemo(() => {
    const approved = filteredTransactions.filter(t => t.status === TransactionStatus.APPROVED);
    const income = approved.filter(t => t.type === TransactionType.CREDIT).reduce((acc, curr) => acc + curr.amount, 0);
    const expenses = approved.filter(t => t.type === TransactionType.DEBIT).reduce((acc, curr) => acc + curr.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i) + (weekOffset * 7));
      return d.toISOString().split('T')[0];
    });

    return days.map(date => {
      const dayTransactions = filteredTransactions.filter(t => 
        t.date === date && t.status === TransactionStatus.APPROVED
      );
      const credit = dayTransactions.filter(t => t.type === TransactionType.CREDIT).reduce((sum, t) => sum + t.amount, 0);
      const debit = dayTransactions.filter(t => t.type === TransactionType.DEBIT).reduce((sum, t) => sum + t.amount, 0);
      return { 
        name: new Date(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }), 
        credit, 
        debit 
      };
    });
  }, [filteredTransactions, weekOffset]);

  const weekRangeLabel = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6 + (weekOffset * 7));
    const end = new Date();
    end.setDate(end.getDate() + (weekOffset * 7));
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
  }, [weekOffset]);

  // --- Handlers ---
  const handleLogin = (email: string, password?: string) => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      setCurrentUser(user);
      setIsAuthModalOpen(false);
    } else {
      alert("Invalid email or password. Default password is 'password123'");
    }
  };

  const handleRegister = (name: string, email: string, password?: string) => {
    if (users.some(u => u.email === email)) {
      alert("Email already registered.");
      return;
    }
    const newUser: User = { id: `u${Date.now()}`, name, email, password, isAdmin: false };
    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthModalOpen(true);
    setSelectedAccountId(null);
    setActiveTab('dashboard');
  };

  const createAccount = (name: string) => {
    if (!currentUser) return;
    const newAcc: Account = {
      id: `acc${Date.now()}`,
      name,
      ownerId: currentUser.id,
      members: [],
      createdAt: new Date().toISOString()
    };
    setAccounts(prev => [...prev, newAcc]);
    setIsNewAccountModalOpen(false);
  };

  const saveTransaction = (data: Omit<Transaction, 'id' | 'status' | 'comments' | 'createdBy' | 'accountId'>) => {
    if (!currentUser || !selectedAccountId) return;
    
    if (transactionToEdit) {
      setTransactions(prev => prev.map(t => 
        t.id === transactionToEdit.id 
          ? { ...t, ...data, status: TransactionStatus.PENDING }
          : t
      ));
    } else {
      const newTx: Transaction = {
        ...data,
        id: `tx${Date.now()}`,
        accountId: selectedAccountId,
        status: TransactionStatus.PENDING,
        comments: [],
        createdBy: currentUser.id
      };
      setTransactions(prev => [...prev, newTx]);
    }
    
    setIsTransactionModalOpen(false);
    setTransactionToEdit(null);
  };

  const updateTransactionStatus = (txId: string, status: TransactionStatus) => {
    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, status } : t));
  };

  const addComment = (txId: string, text: string) => {
    if (!currentUser) return;
    const newComment: Comment = {
      id: `c${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      text,
      createdAt: new Date().toISOString()
    };
    setTransactions(prev => prev.map(t => 
      t.id === txId ? { ...t, comments: [...t.comments, newComment] } : t
    ));
  };

  const shareAccount = (accountId: string, userId: string, role: MemberRole = MemberRole.VIEWER) => {
    setAccounts(prev => prev.map(a => 
      a.id === accountId ? { ...a, members: [...a.members.filter(m => m.userId !== userId), { userId, role }] } : a
    ));
    if (accountToManage?.id === accountId) {
      setAccountToManage(prev => prev ? ({ ...prev, members: [...prev.members.filter(m => m.userId !== userId), { userId, role }] }) : null);
    }
  };

  const removeMember = (accountId: string, userId: string) => {
    setAccounts(prev => prev.map(a => 
      a.id === accountId ? { ...a, members: a.members.filter(m => m.userId !== userId) } : a
    ));
    if (accountToManage?.id === accountId) {
      setAccountToManage(prev => prev ? ({ ...prev, members: prev.members.filter(m => m.userId !== userId) }) : null);
    }
  };

  const fetchInsights = async () => {
    if (!selectedAccount) return;
    setIsAiLoading(true);
    const insights = await getFinancialInsights(selectedAccount, filteredTransactions);
    setAiInsights(insights);
    setIsAiLoading(false);
  };

  // --- UI Sections ---

  const AuthModal = () => {
    const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSubmit = () => {
      if (view === 'login') {
        handleLogin(email, password);
      } else if (view === 'register') {
        if (password !== confirmPassword) {
          alert("Passwords do not match!");
          return;
        }
        handleRegister(name, email, password);
      } else {
        alert("If an account exists with this email, a reset link will be sent to " + email);
        setView('login');
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">ExpensifyPro</h2>
            <p className="text-gray-500">
              {view === 'login' && "Sign in to your account"}
              {view === 'register' && "Create your free account"}
              {view === 'forgot' && "Reset your password"}
            </p>
          </div>
          
          <div className="space-y-4">
            {view === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Enter your name"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="you@example.com"
              />
            </div>
            {view !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
            )}
            {view === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
            )}

            {view === 'login' && (
              <div className="text-right">
                <button 
                  onClick={() => setView('forgot')}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Forgot Password?
                </button>
              </div>
            )}
            
            <Button 
              className="w-full py-3" 
              onClick={handleSubmit}
            >
              {view === 'login' && 'Sign In'}
              {view === 'register' && 'Sign Up'}
              {view === 'forgot' && 'Send Reset Link'}
            </Button>
            
            <div className="text-center text-sm">
              {view === 'login' ? (
                <p>Don't have an account? <button onClick={() => setView('register')} className="text-indigo-600 hover:underline font-medium">Create one</button></p>
              ) : (
                <p>Already have an account? <button onClick={() => setView('login')} className="text-indigo-600 hover:underline font-medium">Sign in</button></p>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const NewAccountModal = () => {
    const [name, setName] = useState('');
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <h3 className="text-xl font-bold mb-4">Create New Account</h3>
          <input 
            autoFocus
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg mb-4 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Account Name (e.g. Travel, Office)"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsNewAccountModalOpen(false)}>Cancel</Button>
            <Button onClick={() => createAccount(name)} disabled={!name.trim()}>Create</Button>
          </div>
        </Card>
      </div>
    );
  };

  const EditMembersModal = () => {
    if (!accountToManage) return null;
    const [inviteEmail, setInviteEmail] = useState('');
    const [selectedRole, setSelectedRole] = useState<MemberRole>(MemberRole.VIEWER);
    const [draft, setDraft] = useState('');
    const [isDrafting, setIsDrafting] = useState(false);

    const handleInviteEmail = async () => {
      if (!inviteEmail.trim()) return;
      setIsDrafting(true);
      const emailDraft = await draftInvitationEmail(accountToManage.name, currentUser?.name || 'Someone', inviteEmail);
      setDraft(emailDraft);
      setIsDrafting(false);
      alert(`Invitation drafted for ${inviteEmail} with ${selectedRole} permissions. Draft text shown below.`);
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Manage Members: {accountToManage.name}</h3>
            <button onClick={() => setIsEditMembersModalOpen(false)} className="text-gray-400 hover:text-gray-600"><Icons.Close /></button>
          </div>

          <div className="space-y-6">
            <section>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Current Members</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                      {users.find(u => u.id === accountToManage.ownerId)?.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{users.find(u => u.id === accountToManage.ownerId)?.name}</p>
                      <RoleBadge role={MemberRole.OWNER} />
                    </div>
                  </div>
                </div>
                {accountToManage.members.map(m => {
                  const user = users.find(u => u.id === m.userId);
                  return (
                    <div key={m.userId} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs">
                          {user?.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-gray-500">{user?.email}</p>
                            <RoleBadge role={m.role} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <select 
                          className="text-[10px] font-bold text-gray-600 bg-gray-50 border-0 rounded p-1 outline-none"
                          value={m.role}
                          onChange={(e) => shareAccount(accountToManage.id, m.userId, e.target.value as MemberRole)}
                        >
                          <option value={MemberRole.VIEWER}>Viewer</option>
                          <option value={MemberRole.EDITOR}>Editor</option>
                        </select>
                        <button 
                          onClick={() => removeMember(accountToManage.id, m.userId)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors"
                          title="Remove Access"
                        >
                          <Icons.UserMinus />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="pt-4 border-t">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Add Existing User</h4>
              <div className="flex gap-2">
                <select 
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  onChange={(e) => {
                    const userId = e.target.value;
                    if (userId) {
                      shareAccount(accountToManage.id, userId, selectedRole);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">Select a user...</option>
                  {users.filter(u => u.id !== accountToManage.ownerId && !accountToManage.members.some(m => m.userId === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                <select 
                  className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as MemberRole)}
                >
                  <option value={MemberRole.VIEWER}>Viewer</option>
                  <option value={MemberRole.EDITOR}>Editor</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">
                * Viewers can only see transactions and comment. Editors can also add and edit transactions.
              </p>
            </section>

            <section className="pt-4 border-t">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Invite via Email</h4>
              <div className="flex gap-2 mb-3">
                <input 
                  type="email" 
                  placeholder="Colleague's email..."
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button onClick={handleInviteEmail} disabled={!inviteEmail.trim() || isDrafting}>
                   <Icons.Mail /> {isDrafting ? 'DRAFTING...' : 'DRAFT INVITE'}
                </Button>
              </div>
              
              {draft && (
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Invitation Draft (Role: {selectedRole})</p>
                    <button onClick={() => setDraft('')} className="text-indigo-400 hover:text-indigo-600"><Icons.Close /></button>
                  </div>
                  <pre className="text-xs text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">{draft}</pre>
                </div>
              )}
            </section>
          </div>
        </Card>
      </div>
    );
  };

  const TransactionModal = () => {
    const [amount, setAmount] = useState(transactionToEdit ? transactionToEdit.amount.toString() : '');
    const [type, setType] = useState<TransactionType>(transactionToEdit ? transactionToEdit.type : TransactionType.DEBIT);
    const [mode, setMode] = useState<PaymentMode>(transactionToEdit ? transactionToEdit.paymentMode : PaymentMode.ONLINE);
    const [comment, setComment] = useState(transactionToEdit ? transactionToEdit.comment : '');
    const [date, setDate] = useState(transactionToEdit ? transactionToEdit.date : new Date().toISOString().split('T')[0]);

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <h3 className="text-xl font-bold mb-4">{transactionToEdit ? 'Edit Transaction' : 'Add Transaction'}</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Transaction Type</label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    className={`flex-1 py-2 rounded-md text-xs font-bold ${type === TransactionType.DEBIT ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}
                    onClick={() => setType(TransactionType.DEBIT)}
                  >
                    Debit
                  </button>
                  <button 
                    className={`flex-1 py-2 rounded-md text-xs font-bold ${type === TransactionType.CREDIT ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}
                    onClick={() => setType(TransactionType.CREDIT)}
                  >
                    Credit
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Mode</label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    className={`flex-1 py-2 rounded-md text-xs font-bold ${mode === PaymentMode.ONLINE ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                    onClick={() => setMode(PaymentMode.ONLINE)}
                  >
                    Online
                  </button>
                  <button 
                    className={`flex-1 py-2 rounded-md text-xs font-bold ${mode === PaymentMode.CASH ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}
                    onClick={() => setMode(PaymentMode.CASH)}
                  >
                    Cash
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({currentCurrency.symbol})</label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment / Note</label>
              <textarea 
                value={comment} 
                onChange={e => setComment(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-20"
                placeholder="What was this for?"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => { setIsTransactionModalOpen(false); setTransactionToEdit(null); }}>Cancel</Button>
              <Button onClick={() => saveTransaction({
                amount: parseFloat(amount),
                type,
                paymentMode: mode,
                comment,
                date
              })} disabled={!amount || !comment.trim()}>
                {transactionToEdit ? 'Update Transaction' : 'Save Transaction'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const Sidebar = () => (
    <div className="w-64 border-r bg-white h-screen fixed left-0 top-0 p-6 flex flex-col hidden md:flex shadow-sm">
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xl">E</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">ExpensifyPro</h1>
      </div>

      <nav className="flex-1 space-y-1">
        <button 
          onClick={() => {setActiveTab('dashboard'); setSelectedAccountId(null);}}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Icons.Dashboard /> Dashboard
        </button>
        <button 
          onClick={() => {setActiveTab('accounts'); setSelectedAccountId(null);}}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'accounts' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Icons.Wallet /> Accounts
        </button>
        <button 
          onClick={() => {setActiveTab('sharing'); setSelectedAccountId(null);}}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'sharing' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Icons.Users /> Manage Teams
        </button>
      </nav>

      <div className="mt-auto space-y-6">
        {currentUser?.isAdmin && (
          <div className="pt-6 border-t">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
              <Icons.Globe /> Display Currency (Admin Only)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => setCurrencyCode(c.code)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${currencyCode === c.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200'}`}
                >
                  {c.symbol} {c.code}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-6 border-t">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
              {currentUser?.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">
                {currentUser?.name} {currentUser?.isAdmin && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">ADMIN</span>}
              </p>
              <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-xs text-red-600 font-bold hover:bg-red-50 rounded-lg transition-colors"
          >
            <Icons.Logout /> SIGN OUT
          </button>
        </div>
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Icons.Search />
            </span>
            <input 
              type="text" 
              placeholder="Search transactions..."
              value={dashboardSearch}
              onChange={(e) => setDashboardSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            />
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-100 shadow-sm">
            <select 
              value={dashboardAccountFilter}
              onChange={(e) => setDashboardAccountFilter(e.target.value)}
              className="text-xs font-bold text-gray-600 bg-transparent px-2 py-1 outline-none"
            >
              <option value="all">All Accounts</option>
              {myAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
            <div className="w-px h-4 bg-gray-100"></div>
            <select 
              value={dashboardTypeFilter}
              onChange={(e) => setDashboardTypeFilter(e.target.value)}
              className="text-xs font-bold text-gray-600 bg-transparent px-2 py-1 outline-none"
            >
              <option value="all">All Types</option>
              <option value={TransactionType.CREDIT}>Credits</option>
              <option value={TransactionType.DEBIT}>Debits</option>
            </select>
            <div className="w-px h-4 bg-gray-100"></div>
            <select 
              value={dashboardModeFilter}
              onChange={(e) => setDashboardModeFilter(e.target.value)}
              className="text-xs font-bold text-gray-600 bg-transparent px-2 py-1 outline-none"
            >
              <option value="all">All Modes</option>
              <option value={PaymentMode.ONLINE}>Online</option>
              <option value={PaymentMode.CASH}>Cash</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-indigo-500 shadow-md">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Balance</p>
          <p className="text-2xl font-bold text-gray-900">{formatValue(stats.balance)}</p>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-md">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Credit</p>
          <p className="text-2xl font-bold text-emerald-600">{formatValue(stats.income)}</p>
        </Card>
        <Card className="border-l-4 border-l-red-500 shadow-md">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Debit</p>
          <p className="text-2xl font-bold text-red-600">{formatValue(stats.expenses)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-96 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Trend Analysis</h3>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setWeekOffset(prev => prev - 1)}
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
                title="Previous Week"
              >
                <Icons.ChevronLeft />
              </button>
              <div className="text-[10px] font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wider">
                {weekOffset === 0 ? 'CURRENT WEEK' : weekRangeLabel}
              </div>
              <button 
                onClick={() => setWeekOffset(prev => prev + 1)}
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
                title="Next Week"
              >
                <Icons.ChevronRight />
              </button>
              {weekOffset !== 0 && (
                <button 
                  onClick={() => setWeekOffset(0)}
                  className="text-[10px] font-bold text-indigo-600 hover:underline ml-1"
                >
                  TODAY
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                  formatter={(val: number) => [formatValue(val), ""]}
                />
                <Bar dataKey="credit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="debit" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Recent Activity</h3>
            <button onClick={() => setActiveTab('accounts')} className="text-xs text-indigo-600 font-bold hover:underline">VIEW ALL ACCOUNTS</button>
          </div>
          <div className="space-y-4">
            {filteredTransactions.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 group">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${t.type === TransactionType.CREDIT ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' : 'bg-red-50 text-red-600 group-hover:bg-red-100'}`}>
                    {t.type === TransactionType.CREDIT ? <Icons.Plus /> : <div className="w-5 h-0.5 bg-current rounded-full" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 line-clamp-1">{t.comment}</p>
                      <PaymentBadge mode={t.paymentMode} />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                      {t.date} • {accounts.find(a => a.id === t.accountId)?.name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${t.type === TransactionType.CREDIT ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.type === TransactionType.CREDIT ? '+' : '-'}{formatValue(t.amount)}
                  </p>
                  <Badge status={t.status} />
                </div>
              </div>
            ))}
            {filteredTransactions.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                  <Icons.Search />
                </div>
                <p className="text-gray-400 font-medium">No results found.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );

  const AccountsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Your Accounts</h2>
        <Button onClick={() => setIsNewAccountModalOpen(true)}>
          <Icons.Plus /> New Account
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myAccounts.map(acc => {
          const accTxs = transactions.filter(t => t.accountId === acc.id && t.status === TransactionStatus.APPROVED);
          const balance = accTxs.reduce((sum, t) => sum + (t.type === TransactionType.CREDIT ? t.amount : -t.amount), 0);
          return (
            <Card key={acc.id} className="hover:border-indigo-300 transition-all cursor-pointer group shadow-sm hover:shadow-md" onClick={() => setSelectedAccountId(acc.id)}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600">{acc.name}</h3>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{new Date(acc.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{formatValue(balance)}</p>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <Icons.Users /> {acc.members.length + 1} People
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const SharingView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Manage Teams & Permissions</h2>
      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account</th>
                <th className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">My Role</th>
                <th className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team Composition</th>
                <th className="pb-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Access Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {myAccounts.map(acc => {
                const myRole = acc.ownerId === currentUser?.id ? MemberRole.OWNER : (acc.members.find(m => m.userId === currentUser?.id)?.role || MemberRole.VIEWER);
                return (
                  <tr key={acc.id} className="group">
                    <td className="py-4">
                      <p className="font-bold text-gray-900">{acc.name}</p>
                      <p className="text-[10px] text-gray-400">Created {new Date(acc.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="py-4">
                      <RoleBadge role={myRole} />
                    </td>
                    <td className="py-4">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-600 z-10" title="Owner">
                          {users.find(u => u.id === acc.ownerId)?.name.charAt(0)}
                        </div>
                        {acc.members.map(m => (
                          <div key={m.userId} className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600" title={`${users.find(u => u.id === m.userId)?.name} (${m.role})`}>
                            {users.find(u => u.id === m.userId)?.name.charAt(0)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      {acc.ownerId === currentUser?.id ? (
                        <Button variant="secondary" onClick={() => {
                          setAccountToManage(acc);
                          setIsEditMembersModalOpen(true);
                        }}>
                          <Icons.Users /> MANAGE TEAM
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium italic">Managed by {users.find(u => u.id === acc.ownerId)?.name}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const SelectedAccountView = () => {
    const [newComment, setNewComment] = useState<{ [key: string]: string }>({});

    if (!selectedAccount) return null;

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button 
              onClick={() => setSelectedAccountId(null)}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-bold mb-2 flex items-center gap-1 group"
            >
              <span className="transition-transform group-hover:-translate-x-1">←</span> BACK TO ACCOUNTS
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-gray-900">{selectedAccount.name}</h2>
              <RoleBadge role={userPermissionInAccount} />
            </div>
          </div>
          <div className="flex gap-2">
             {selectedAccount.ownerId === currentUser?.id && (
               <Button variant="secondary" onClick={() => {
                 setAccountToManage(selectedAccount);
                 setIsEditMembersModalOpen(true);
               }}>
                 <Icons.UserPlus /> MANAGE TEAM
               </Button>
             )}
            <Button variant="ai" onClick={fetchInsights} disabled={isAiLoading}>
              <Icons.Sparkles /> {isAiLoading ? 'ANALYZING...' : 'AI INSIGHTS'}
            </Button>
            {canEditSelectedAccount && (
              <Button onClick={() => { setTransactionToEdit(null); setIsTransactionModalOpen(true); }}>
                <Icons.Plus /> ADD TRANSACTION
              </Button>
            )}
          </div>
        </div>

        <Card className="p-3 shadow-sm border-0 flex items-center gap-4">
          <div className="relative flex-1">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Icons.Search />
            </span>
            <input 
              type="text" 
              placeholder="Search in this account..."
              value={dashboardSearch}
              onChange={(e) => setDashboardSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
             <select 
              value={dashboardTypeFilter}
              onChange={(e) => setDashboardTypeFilter(e.target.value)}
              className="text-xs font-bold text-gray-600 bg-gray-50 border-0 rounded-lg px-3 py-2 outline-none"
            >
              <option value="all">All Types</option>
              <option value={TransactionType.CREDIT}>Credit</option>
              <option value={TransactionType.DEBIT}>Debit</option>
            </select>
             <select 
              value={dashboardModeFilter}
              onChange={(e) => setDashboardModeFilter(e.target.value)}
              className="text-xs font-bold text-gray-600 bg-gray-50 border-0 rounded-lg px-3 py-2 outline-none"
            >
              <option value="all">All Modes</option>
              <option value={PaymentMode.ONLINE}>Online</option>
              <option value={PaymentMode.CASH}>Cash</option>
            </select>
          </div>
        </Card>

        {aiInsights && (
          <Card className="bg-indigo-50 border-indigo-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-indigo-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Icons.Sparkles /> AI Performance Analysis
              </h4>
              <button onClick={() => setAiInsights(null)} className="text-indigo-400 hover:text-indigo-600"><Icons.Close /></button>
            </div>
            <div className="prose prose-indigo max-w-none text-indigo-800 text-sm whitespace-pre-line leading-relaxed">
              {aiInsights}
            </div>
          </Card>
        )}

        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left bg-gray-50 border-b border-gray-100">
                  <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mode</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTransactions.map(t => (
                  <React.Fragment key={t.id}>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-4 text-xs font-medium text-gray-500 whitespace-nowrap">{t.date}</td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-gray-900">{t.comment}</p>
                        <p className="text-[10px] text-gray-400 font-medium">By {users.find(u => u.id === t.createdBy)?.name}</p>
                      </td>
                      <td className="py-4 px-4">
                        <PaymentBadge mode={t.paymentMode} />
                      </td>
                      <td className="py-4 px-4">
                        <span className={`font-bold ${t.type === TransactionType.CREDIT ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.type === TransactionType.CREDIT ? '+' : '-'}{formatValue(t.amount)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <Badge status={t.status} />
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        {canEditSelectedAccount && (
                          <div className="flex justify-end gap-1">
                            <button 
                              className="p-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                              onClick={() => {
                                setTransactionToEdit(t);
                                setIsTransactionModalOpen(true);
                              }}
                              title="Edit"
                            >
                              <Icons.Edit />
                            </button>
                            
                            {t.status === TransactionStatus.PENDING && (
                              <>
                                <button 
                                  className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors"
                                  onClick={() => updateTransactionStatus(t.id, TransactionStatus.APPROVED)}
                                  title="Approve"
                                >
                                  <Icons.Check />
                                </button>
                                <button 
                                  className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                                  onClick={() => updateTransactionStatus(t.id, TransactionStatus.REJECTED)}
                                  title="Reject"
                                >
                                  <Icons.Close />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="px-4 pb-4 bg-gray-50/30">
                        <div className="bg-white border border-gray-100 rounded-lg p-3 mt-1 shadow-sm">
                          <div className="space-y-2 mb-3">
                            {t.comments.map(c => (
                              <div key={c.id} className="text-xs">
                                <span className="font-bold text-indigo-600 uppercase tracking-tighter mr-1">{c.userName}</span>
                                <span className="text-gray-700">{c.text}</span>
                                <span className="text-gray-300 ml-2 text-[9px]">{new Date(c.createdAt).toLocaleTimeString()}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={newComment[t.id] || ''}
                              onChange={(e) => setNewComment({ ...newComment, [t.id]: e.target.value })}
                              placeholder="Add feedback..."
                              className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newComment[t.id]) {
                                  addComment(t.id, newComment[t.id]);
                                  setNewComment({ ...newComment, [t.id]: '' });
                                }
                              }}
                            />
                            <button 
                              className="text-[10px] font-bold text-indigo-600 px-3 hover:text-indigo-800 uppercase tracking-wider"
                              onClick={() => {
                                if (newComment[t.id]) {
                                  addComment(t.id, newComment[t.id]);
                                  setNewComment({ ...newComment, [t.id]: '' });
                                }
                              }}
                            >
                              SEND
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 transition-all overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          {selectedAccountId ? (
            <SelectedAccountView />
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'accounts' && <AccountsView />}
              {activeTab === 'sharing' && <SharingView />}
            </>
          )}
        </div>
      </main>

      {isAuthModalOpen && <AuthModal />}
      {isNewAccountModalOpen && <NewAccountModal />}
      {isTransactionModalOpen && <TransactionModal />}
      {isEditMembersModalOpen && <EditMembersModal />}
    </div>
  );
};

export default App;