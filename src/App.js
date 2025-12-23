import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Clock, Play, Pause, RotateCcw, LogOut, User, BookOpen, TrendingUp, Plus, X, 
  ChevronDown, Award, Target, Flame, Download, Sun, Moon, Bell, BellOff,
  AlertCircle, CheckCircle, Info, StopCircle, BarChart3, Settings
} from 'lucide-react';
import Papa from 'papaparse';

// Toast Notification Component
const Toast = ({ message, type, onClose }) => {
  const icons = {
    error: <AlertCircle className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const colors = {
    error: 'bg-red-500/90 border-red-500 text-white',
    success: 'bg-green-500/90 border-green-500 text-white',
    info: 'bg-blue-500/90 border-blue-500 text-white',
  };

  return (
    <div className={`fixed top-6 right-6 z-50 ${colors[type]} border px-6 py-4 rounded-xl backdrop-blur-lg flex items-center gap-3 max-w-md shadow-2xl animate-slideIn`}>
      {icons[type]}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Loading Screen Component
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col items-center justify-center p-4">
    <div className="relative">
      <div className="w-20 h-20 border-4 border-white/20 border-t-blue-400 rounded-full animate-spin"></div>
      <BookOpen className="absolute inset-0 m-auto w-10 h-10 text-white" />
    </div>
    <h1 className="text-2xl font-bold text-white mt-6">Loading Study Timer...</h1>
    <p className="text-blue-200 mt-2">Initializing your study session</p>
  </div>
);

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAlZxYjZGbY4668sh2f899U1k5t9kDlsi8",
  authDomain: "study-timer-d71eb.firebaseapp.com",
  projectId: "study-timer-d71eb",
  storageBucket: "study-timer-d71eb.firebasestorage.app",
  messagingSenderId: "563800301508",
  appId: "1:563800301508:web:3acb964a5675450d32ce91"
};

// Firebase initialization
let firebaseInstance = null;
let isFirebaseInitialized = false;

const initializeFirebase = async () => {
  return new Promise((resolve, reject) => {
    if (isFirebaseInitialized && firebaseInstance) {
      resolve(firebaseInstance);
      return;
    }

    if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
      firebaseInstance = window.firebase;
      isFirebaseInitialized = true;
      resolve(firebaseInstance);
      return;
    }

    const scriptsLoaded = document.querySelectorAll('script[src*="firebase"]').length > 0;
    
    if (scriptsLoaded) {
      setTimeout(() => {
        if (window.firebase) {
          if (!window.firebase.apps.length) {
            window.firebase.initializeApp(firebaseConfig);
          }
          firebaseInstance = window.firebase;
          isFirebaseInitialized = true;
          resolve(firebaseInstance);
        } else {
          reject(new Error('Firebase failed to load'));
        }
      }, 100);
      return;
    }

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js'),
      loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js'),
      loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js')
    ])
      .then(() => {
        try {
          const firebase = window.firebase;
          firebase.initializeApp(firebaseConfig);
          firebaseInstance = firebase;
          isFirebaseInitialized = true;
          resolve(firebase);
        } catch (error) {
          if (window.firebase?.apps?.length > 0) {
            firebaseInstance = window.firebase;
            isFirebaseInitialized = true;
            resolve(window.firebase);
          } else {
            reject(error);
          }
        }
      })
      .catch(reject);
  });
};

// Helper function to create Firestore-compatible timestamp data
const createTimestampData = () => {
  const now = new Date();
  return {
    seconds: Math.floor(now.getTime() / 1000),
    nanoseconds: (now.getTime() % 1000) * 1000000,
    toDate: () => now
  };
};

const StudyTimer = () => {
  // State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Timer states
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSubject, setCurrentSubject] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  
  // Data states
  const [sessions, setSessions] = useState([]);
  const [totalStudyTime, setTotalStudyTime] = useState(0);
  const [subjectStats, setSubjectStats] = useState({});
  const [dailyGoal, setDailyGoal] = useState(14400);
  const [weeklyGoal, setWeeklyGoal] = useState(72000);
  const [streak, setStreak] = useState(0);
  
  // UI states
  const [selectedHistorySubject, setSelectedHistorySubject] = useState('all');
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [tempDailyGoal, setTempDailyGoal] = useState(4);
  const [tempWeeklyGoal, setTempWeeklyGoal] = useState(20);
  const [activeTab, setActiveTab] = useState('timer');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Notification states
  const [toasts, setToasts] = useState([]);
  
  // Refs
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const firebaseRef = useRef(null);

  const MAX_SESSION_SECONDS = 43200;

  // Toast management with useCallback
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  }, []);

  // Initialize Firebase
  useEffect(() => {
    const init = async () => {
      try {
        const firebase = await initializeFirebase();
        firebaseRef.current = firebase;
        
        // Set up auth state listener
        firebase.auth().onAuthStateChanged(async (authUser) => {
          if (authUser) {
            setUser(authUser);
            await loadUserData(authUser.uid);
          } else {
            setUser(null);
          }
          setLoading(false);
        });

        // Check theme preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('studyTimerTheme');
        setIsDark(savedTheme === 'dark' || (!savedTheme && prefersDark));
        
      } catch (err) {
        console.error('Firebase initialization error:', err);
        showToast('Working in offline mode', 'info');
        setLoading(false);
      }
    };

    init();
  }, [showToast]);

  // Theme effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('studyTimerTheme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('studyTimerTheme', 'light');
    }
  }, [isDark]);

  // Timer effect
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime(prev => {
          if (prev + 1 >= MAX_SESSION_SECONDS) {
            setIsRunning(false);
            showToast('Maximum session length (12 hours) reached!', 'info');
            return MAX_SESSION_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, showToast]);

  // Load user data with useCallback
  const loadUserData = useCallback(async (uid) => {
    if (!firebaseRef.current) {
      showToast('App not initialized', 'error');
      return;
    }

    try {
      const db = firebaseRef.current.firestore();
      
      // Load user document
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (userDoc.exists) {
        const data = userDoc.data();
        setTotalStudyTime(data.totalStudyTime || 0);
        setSubjects(data.subjects || []);
        setSubjectStats(data.subjectStats || {});
        setDailyGoal(data.dailyGoal || 14400);
        setWeeklyGoal(data.weeklyGoal || 72000);
        setStreak(data.streak || 0);
        setIsDark(data.theme !== 'light');
        setRemindersEnabled(data.remindersEnabled || false);
        setTempDailyGoal((data.dailyGoal || 14400) / 3600);
        setTempWeeklyGoal((data.weeklyGoal || 72000) / 3600);
      } else {
        // Create user document - FIXED: Use serverTimestamp() properly
        await db.collection('users').doc(uid).set({
          subjects: [],
          subjectStats: {},
          totalStudyTime: 0,
          dailyGoal: 14400,
          weeklyGoal: 72000,
          streak: 0,
          theme: isDark ? 'dark' : 'light',
          remindersEnabled: false,
          createdAt: firebaseRef.current.firestore.FieldValue.serverTimestamp()
        });
      }

      // Load sessions
      const sessionsQuery = db.collection('sessions')
        .where('userId', '==', uid)
        .orderBy('startTime', 'desc')
        .limit(50);

      const sessionsSnap = await sessionsQuery.get();
      const sessionsData = sessionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamp to Date
        startTime: doc.data().startTime?.toDate?.(),
        endTime: doc.data().endTime?.toDate?.()
      }));
      
      setSessions(sessionsData);
      
    } catch (err) {
      console.error('Error loading user data:', err);
      showToast('Failed to load data', 'error');
    }
  }, [isDark, showToast]);

  // Add subject
  const addSubject = async () => {
    const trimmed = newSubject.trim();
    if (!trimmed) {
      showToast('Subject name cannot be empty', 'error');
      return;
    }

    if (subjects.includes(trimmed)) {
      showToast('Subject already exists', 'error');
      return;
    }

    const updatedSubjects = [...subjects, trimmed];
    setSubjects(updatedSubjects);
    setNewSubject('');
    setShowAddSubject(false);

    if (firebaseRef.current && user) {
      try {
        await firebaseRef.current.firestore()
          .collection('users')
          .doc(user.uid)
          .update({ subjects: updatedSubjects });
        showToast('Subject added successfully!', 'success');
      } catch (err) {
        console.error('Error adding subject:', err);
        showToast('Failed to save subject', 'error');
      }
    }
  };

  // Remove subject
  const removeSubject = async (subjectToRemove) => {
    if (currentSubject === subjectToRemove && isRunning) {
      showToast('Cannot remove active subject while timer is running', 'error');
      return;
    }

    const updatedSubjects = subjects.filter(s => s !== subjectToRemove);
    setSubjects(updatedSubjects);
    
    if (currentSubject === subjectToRemove) {
      setCurrentSubject('');
    }

    if (firebaseRef.current && user) {
      try {
        await firebaseRef.current.firestore()
          .collection('users')
          .doc(user.uid)
          .update({ subjects: updatedSubjects });
        showToast('Subject removed', 'success');
      } catch (err) {
        console.error('Error removing subject:', err);
        showToast('Failed to remove subject', 'error');
      }
    }
  };

  // Save session - FIXED: Use proper Firestore timestamp
  const saveSession = async (duration) => {
    if (!user || !currentSubject) {
      showToast('Cannot save session', 'error');
      return;
    }

    if (duration < 60) {
      showToast('Session must be at least 1 minute to save', 'info');
      return;
    }

    try {
      const db = firebaseRef.current?.firestore?.();
      if (!db) {
        throw new Error('Firestore not available');
      }
      
      // Use Firestore's serverTimestamp() or create a proper timestamp
      const timestamp = firebaseRef.current.firestore.FieldValue.serverTimestamp();
      const startTs = startTimeRef.current || timestamp;

      const sessionData = {
        userId: user.uid,
        userEmail: user.email,
        subject: currentSubject,
        duration: duration,
        startTime: startTs,
        endTime: timestamp,
        date: new Date().toISOString().split('T')[0]
      };

      // Save session
      await db.collection('sessions').add(sessionData);

      // Update user stats
      const newTotalStudyTime = totalStudyTime + duration;
      const newStats = { ...subjectStats };
      
      if (!newStats[currentSubject]) {
        newStats[currentSubject] = { 
          totalTime: 0, 
          highestSession: 0, 
          sessionCount: 0 
        };
      }

      newStats[currentSubject].totalTime += duration;
      newStats[currentSubject].sessionCount += 1;
      newStats[currentSubject].highestSession = Math.max(duration, newStats[currentSubject].highestSession);

      // Update user document
      await db.collection('users').doc(user.uid).update({
        totalStudyTime: newTotalStudyTime,
        subjectStats: newStats
      });

      setTotalStudyTime(newTotalStudyTime);
      setSubjectStats(newStats);
      
      // Refresh data
      await loadUserData(user.uid);
      
      showToast(`Session saved: ${formatDuration(duration)} of ${currentSubject}`, 'success');
      
    } catch (err) {
      console.error('Error saving session:', err);
      showToast('Failed to save session', 'error');
    }
  };

  // Timer controls - FIXED: Store Date instead of custom object
  const handleStart = () => {
    if (!currentSubject) {
      showToast('Please select a subject first', 'error');
      return;
    }

    try {
      // Store the current time as a regular Date object
      startTimeRef.current = new Date();
      setIsRunning(true);
      showToast(`Started studying ${currentSubject}`, 'success');
    } catch (err) {
      console.error('Error starting timer:', err);
      showToast('Failed to start timer', 'error');
    }
  };

  const handlePause = () => {
    setIsRunning(false);
    showToast('Timer paused', 'info');
  };

  const handleStop = async () => {
    if (isRunning && time >= 60) {
      await saveSession(time);
    }
    setTime(0);
    setIsRunning(false);
    startTimeRef.current = null;
    showToast('Timer stopped', 'success');
  };

  const handleReset = () => {
    if (isRunning) {
      setIsRunning(false);
    }
    setTime(0);
    startTimeRef.current = null;
    showToast('Timer reset', 'info');
  };

  // Authentication handlers
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    
    if (!firebaseRef.current) {
      showToast('App not initialized', 'error');
      return;
    }

    try {
      if (authMode === 'login') {
        await firebaseRef.current.auth().signInWithEmailAndPassword(email, password);
        showToast('Welcome back!', 'success');
      } else {
        await firebaseRef.current.auth().createUserWithEmailAndPassword(email, password);
        showToast('Account created successfully!', 'success');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      showToast(err.message || 'Authentication failed', 'error');
    }
  };

  const handleGoogleAuth = async () => {
    if (!firebaseRef.current) {
      showToast('App not initialized', 'error');
      return;
    }

    try {
      const provider = new firebaseRef.current.auth.GoogleAuthProvider();
      await firebaseRef.current.auth().signInWithPopup(provider);
      showToast('Welcome!', 'success');
    } catch (err) {
      console.error('Google auth error:', err);
      showToast('Sign-in failed', 'error');
    }
  };

  const handleLogout = async () => {
    if (isRunning && time >= 60) {
      await saveSession(time);
    }

    try {
      if (firebaseRef.current) {
        await firebaseRef.current.auth().signOut();
      }
      showToast('Logged out successfully', 'success');
      
      // Reset local state
      setTime(0);
      setIsRunning(false);
      setCurrentSubject('');
      setSubjects([]);
      setSessions([]);
      setTotalStudyTime(0);
      setSubjectStats({});
      setStreak(0);
    } catch (err) {
      console.error('Logout error:', err);
      showToast('Logout failed', 'error');
    }
  };

  // Export to CSV
  const exportCSV = () => {
    if (sessions.length === 0) {
      showToast('No sessions to export', 'info');
      return;
    }

    try {
      const data = sessions.map(session => ({
        Date: session.date,
        Subject: session.subject,
        'Duration (min)': Math.round(session.duration / 60),
        'Duration (sec)': session.duration,
        'Start Time': session.startTime?.toLocaleString?.(),
        'End Time': session.endTime?.toLocaleString?.()
      }));

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `study-sessions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('Data exported successfully!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export data', 'error');
    }
  };

  // Save goals
  const saveGoals = async () => {
    const newDailyGoal = Math.max(0.5, tempDailyGoal) * 3600;
    const newWeeklyGoal = Math.max(1, tempWeeklyGoal) * 3600;
    
    setDailyGoal(newDailyGoal);
    setWeeklyGoal(newWeeklyGoal);
    setShowGoalModal(false);

    if (firebaseRef.current && user) {
      try {
        await firebaseRef.current.firestore()
          .collection('users')
          .doc(user.uid)
          .update({
            dailyGoal: newDailyGoal,
            weeklyGoal: newWeeklyGoal
          });
        showToast('Goals updated successfully!', 'success');
      } catch (err) {
        console.error('Error saving goals:', err);
        showToast('Failed to save goals', 'error');
      }
    }
  };

  // Toggle theme
  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    if (firebaseRef.current && user) {
      try {
        await firebaseRef.current.firestore()
          .collection('users')
          .doc(user.uid)
          .update({ theme: newTheme ? 'dark' : 'light' });
      } catch (err) {
        console.error('Error saving theme:', err);
      }
    }
  };

  // Toggle reminders
  const toggleReminders = async () => {
    if (!remindersEnabled) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Please enable notifications', 'error');
        return;
      }
    }

    const newState = !remindersEnabled;
    setRemindersEnabled(newState);
    
    if (firebaseRef.current && user) {
      try {
        await firebaseRef.current.firestore()
          .collection('users')
          .doc(user.uid)
          .update({ remindersEnabled: newState });
        
        showToast(
          newState ? 'Reminders enabled!' : 'Reminders disabled',
          newState ? 'success' : 'info'
        );
      } catch (err) {
        console.error('Error saving reminders:', err);
      }
    }
  };

  // Utility functions with useCallback
  const formatTime = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  }, []);

  const formatDuration = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  const getTodayStudyTime = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return sessions
      .filter(session => session.date === today)
      .reduce((total, session) => total + (session.duration || 0), 0);
  }, [sessions]);

  const getWeekStudyTime = useCallback(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    return sessions
      .filter(session => {
        const sessionTime = session.startTime || new Date(0);
        return sessionTime >= weekStart;
      })
      .reduce((total, session) => total + (session.duration || 0), 0);
  }, [sessions]);

  const filteredSessions = useMemo(() => 
    selectedHistorySubject === 'all'
      ? sessions
      : sessions.filter(session => session.subject === selectedHistorySubject),
    [sessions, selectedHistorySubject]
  );

  // Responsive check
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Loading state
  if (loading) {
    return <LoadingScreen />;
  }

  // Auth screen
  if (!user) {
    return (
      <>
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} />
        ))}
        
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob top-0 -left-4"></div>
            <div className="absolute w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 top-0 -right-4"></div>
            <div className="absolute w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 bottom-0 left-20"></div>
          </div>

          <div className="bg-gray-800/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-md relative z-10 border border-gray-700">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mb-4">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">Study Timer</h1>
              <p className="text-blue-200">Track your learning journey</p>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all active:scale-95"
              >
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </form>

            <div className="flex items-center my-6">
              <div className="flex-1 h-px bg-gray-600"></div>
              <span className="px-4 text-gray-400 text-sm">or continue with</span>
              <div className="flex-1 h-px bg-gray-600"></div>
            </div>

            <button
              onClick={handleGoogleAuth}
              className="w-full py-3 bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-100 transition-all active:scale-95 flex items-center justify-center space-x-2 mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Google</span>
            </button>

            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="w-full text-blue-400 hover:text-blue-300 transition-colors text-center block"
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} />
      ))}
      
      <div className={`min-h-screen p-4 transition-colors duration-300 ${
        isDark 
          ? 'bg-gray-900 text-white' 
          : 'bg-gray-100 text-gray-900'
      }`}>
        <div className="absolute inset-0 overflow-hidden">
          {isDark ? (
            <>
              <div className="absolute w-96 h-96 bg-blue-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob top-0 -left-4"></div>
              <div className="absolute w-96 h-96 bg-purple-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 top-0 -right-4"></div>
              <div className="absolute w-96 h-96 bg-pink-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 bottom-0 left-20"></div>
            </>
          ) : (
            <>
              <div className="absolute w-96 h-96 bg-blue-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob top-0 -left-4"></div>
              <div className="absolute w-96 h-96 bg-purple-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000 top-0 -right-4"></div>
              <div className="absolute w-96 h-96 bg-pink-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000 bottom-0 left-20"></div>
            </>
          )}
        </div>

        {/* Mobile Navigation */}
        {isMobile && (
          <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
            <div className={`backdrop-blur-lg rounded-2xl p-2 border ${
              isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'
            }`}>
              <div className="flex justify-around">
                <button
                  onClick={() => setActiveTab('timer')}
                  className={`flex flex-col items-center p-2 rounded-lg transition ${
                    activeTab === 'timer' 
                      ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900')
                      : (isDark ? 'text-gray-400' : 'text-gray-600')
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span className="text-xs mt-1">Timer</span>
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex flex-col items-center p-2 rounded-lg transition ${
                    activeTab === 'stats'
                      ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900')
                      : (isDark ? 'text-gray-400' : 'text-gray-600')
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span className="text-xs mt-1">Stats</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex flex-col items-center p-2 rounded-lg transition ${
                    activeTab === 'history'
                      ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900')
                      : (isDark ? 'text-gray-400' : 'text-gray-600')
                  }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-xs mt-1">History</span>
                </button>
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className={`flex flex-col items-center p-2 rounded-lg transition ${
                    isMobileMenuOpen
                      ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900')
                      : (isDark ? 'text-gray-400' : 'text-gray-600')
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-xs mt-1">Menu</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto relative z-10 pb-20 sm:pb-0">
          {/* Header */}
          <div className={`backdrop-blur-lg rounded-2xl p-6 mb-6 border flex flex-wrap items-center justify-between gap-4 ${
            isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'
          }`}>
            <div className="flex items-center space-x-4">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-white/30" />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {user.displayName || user.email}
                </h2>
                <div className={`flex items-center gap-4 text-sm ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                  <span>Total: {formatDuration(totalStudyTime)}</span>
                  <span className="flex items-center">
                    <Flame className="w-4 h-4 mr-1 text-orange-400" />
                    {streak} day{streak !== 1 ? 's' : ''} streak
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isMobile && (
                <>
                  <button 
                    onClick={toggleReminders} 
                    className={`p-2 rounded-lg transition ${
                      remindersEnabled 
                        ? (isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600')
                        : (isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700')
                    }`}
                    title={remindersEnabled ? 'Disable reminders' : 'Enable reminders'}
                  >
                    {remindersEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={toggleTheme} 
                    className={`p-2 rounded-lg transition ${
                      isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                    title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                </>
              )}
              <button 
                onClick={handleLogout} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  isDark ? 'bg-red-500/20 hover:bg-red-500/30 text-red-200' : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobile && isMobileMenuOpen && (
            <div className={`backdrop-blur-lg rounded-2xl p-4 mb-4 border animate-slideIn ${
              isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Quick Settings</h3>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-700'}`} />
                </button>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={toggleReminders} 
                  className={`w-full flex items-center justify-between p-3 rounded-lg ${
                    remindersEnabled 
                      ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100')
                      : (isDark ? 'bg-gray-700/50' : 'bg-gray-100')
                  }`}
                >
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>Reminders</span>
                  {remindersEnabled ? (
                    <Bell className={`w-5 h-5 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
                  ) : (
                    <BellOff className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  )}
                </button>
                <button 
                  onClick={toggleTheme} 
                  className={`w-full flex items-center justify-between p-3 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}
                >
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>Theme</span>
                  {isDark ? (
                    <Sun className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <Moon className="w-5 h-5 text-blue-600" />
                  )}
                </button>
                <button 
                  onClick={() => setShowGoalModal(true)} 
                  className={`w-full flex items-center justify-between p-3 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}
                >
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>Goals</span>
                  <Target className="w-5 h-5 text-green-500" />
                </button>
              </div>
            </div>
          )}

          {/* Goals */}
          {(!isMobile || activeTab === 'stats') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div className={`backdrop-blur-lg rounded-2xl p-6 border ${
                isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className={`font-semibold flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Target className="w-5 h-5 mr-2" /> Daily Goal
                  </h3>
                  {!isMobile && (
                    <button 
                      onClick={() => setShowGoalModal(true)} 
                      className={`text-sm hover:underline transition ${
                        isDark ? 'text-blue-300' : 'text-blue-600'
                      }`}
                    >
                      Edit
                    </button>
                  )}
                </div>
                <p className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatDuration(getTodayStudyTime())} / {formatDuration(dailyGoal)}
                </p>
                <div className={`w-full rounded-full h-4 overflow-hidden ${
                  isDark ? 'bg-gray-700' : 'bg-gray-300'
                }`}>
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (getTodayStudyTime() / dailyGoal) * 100)}%` }}
                  />
                </div>
              </div>

              <div className={`backdrop-blur-lg rounded-2xl p-6 border ${
                isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Weekly Goal</h3>
                  {!isMobile && (
                    <button 
                      onClick={() => setShowGoalModal(true)} 
                      className={`text-sm hover:underline transition ${
                        isDark ? 'text-blue-300' : 'text-blue-600'
                      }`}
                    >
                      Edit
                    </button>
                  )}
                </div>
                <p className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatDuration(getWeekStudyTime())} / {formatDuration(weeklyGoal)}
                </p>
                <div className={`w-full rounded-full h-4 overflow-hidden ${
                  isDark ? 'bg-gray-700' : 'bg-gray-300'
                }`}>
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (getWeekStudyTime() / weeklyGoal) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="lg:grid lg:grid-cols-3 gap-6">
            {/* Timer Section */}
            {(!isMobile || activeTab === 'timer') && (
              <div className="lg:col-span-2 space-y-6 mb-6 lg:mb-0">
                {/* Subject Selection */}
                <div className={`backdrop-blur-lg rounded-2xl p-6 border ${
                  isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'
                }`}>
                  <h3 className={`text-xl font-semibold mb-4 flex items-center ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    <BookOpen className="w-5 h-5 mr-2" /> Select Subject
                  </h3>

                  <div className="flex flex-wrap gap-3 mb-4">
                    {subjects.map(subject => (
                      <div key={subject} className="relative group">
                        <button
                          onClick={() => !isRunning && setCurrentSubject(subject)}
                          disabled={isRunning}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            currentSubject === subject
                              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                              : (isDark 
                                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300')
                          } ${isRunning && currentSubject !== subject ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {subject}
                        </button>
                        {!isRunning && (
                          <button
                            onClick={() => removeSubject(subject)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg"
                            title="Remove subject"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        )}
                      </div>
                    ))}

                    {showAddSubject ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newSubject}
                          onChange={e => setNewSubject(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addSubject()}
                          placeholder="New subject"
                          autoFocus
                          className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${
                            isDark 
                              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                        />
                        <button 
                          onClick={addSubject} 
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          Add
                        </button>
                        <button 
                          onClick={() => { setShowAddSubject(false); setNewSubject(''); }} 
                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddSubject(true)}
                        disabled={isRunning}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDark 
                            ? 'bg-gray-700 text-white hover:bg-gray-600' 
                            : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        Add Subject
                      </button>
                    )}
                  </div>

                  {currentSubject && (
                    <div className={`rounded-lg p-3 border ${
                      isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-300'
                    }`}>
                      <p className={isDark ? 'text-blue-300' : 'text-blue-600'}>
                        Current: <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{currentSubject}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Timer */}
                <div className={`backdrop-blur-lg rounded-2xl p-8 border text-center ${
                  isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'
                }`}>
                  <div className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mb-6 shadow-lg ${isRunning ? 'animate-spin-slow' : ''}`}>
                    <Clock className="w-10 h-10 text-white" />
                  </div>

                  <div className={`text-7xl md:text-8xl font-bold mb-8 font-mono tracking-tight ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {formatTime(time)}
                  </div>

                  <div className="flex flex-wrap justify-center gap-6">
                    {!isRunning ? (
                      <button
                        onClick={handleStart}
                        disabled={!currentSubject}
                        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:scale-105 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        <Play className="w-6 h-6" />
                        Start
                      </button>
                    ) : (
                      <button
                        onClick={handlePause}
                        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-xl font-semibold hover:scale-105 active:scale-95 transition"
                      >
                        <Pause className="w-6 h-6" />
                        Pause
                      </button>
                    )}

                    <button
                      onClick={handleStop}
                      className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-semibold hover:scale-105 active:scale-95 transition"
                    >
                      <StopCircle className="w-6 h-6" />
                      Stop
                    </button>

                    <button
                      onClick={handleReset}
                      className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-gray-500 to-gray-700 text-white rounded-xl font-semibold hover:scale-105 active:scale-95 transition"
                    >
                      <RotateCcw className="w-6 h-6" />
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Right Column: Stats & History */}
            <div className="space-y-6">
              {/* Subject Stats */}
              {(!isMobile || activeTab === 'stats') && (
                <div className={`backdrop-blur-lg rounded-2xl p-6 border ${
                  isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <Award className="w-6 h-6 text-yellow-500" />
                    <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Subject Stats</h3>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {Object.entries(subjectStats).length === 0 ? (
                      <p className={`text-center py-4 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        No data yet. Start studying!
                      </p>
                    ) : (
                      Object.entries(subjectStats)
                        .sort(([, a], [, b]) => b.totalTime - a.totalTime)
                        .map(([subject, stats]) => (
                          <div 
                            key={subject} 
                            className={`rounded-lg p-4 border hover:bg-opacity-50 transition ${
                              isDark ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-600' : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            <h4 className={`font-semibold mb-2 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{subject}</h4>
                            <div className="text-sm space-y-1">
                              <div className={`flex justify-between ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                                <span>Total</span>
                                <span className={isDark ? 'text-white' : 'text-gray-900'}>{formatDuration(stats.totalTime)}</span>
                              </div>
                              <div className={`flex justify-between ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                                <span>Best</span>
                                <span className="text-yellow-500">{formatDuration(stats.highestSession)}</span>
                              </div>
                              <div className={`flex justify-between ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                                <span>Sessions</span>
                                <span className={isDark ? 'text-white' : 'text-gray-900'}>{stats.sessionCount}</span>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {/* History */}
              {(!isMobile || activeTab === 'history') && (
                <div className={`backdrop-blur-lg rounded-2xl p-6 border ${
                  isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'
                }`}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-blue-400" />
                      <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Study History</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <button
                          onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                            isDark 
                              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          <span>{selectedHistorySubject === 'all' ? 'All' : selectedHistorySubject}</span>
                          <ChevronDown className="w-4 h-4 transition-transform" style={{ transform: showHistoryDropdown ? 'rotate(180deg)' : 'none' }} />
                        </button>
                        {showHistoryDropdown && (
                          <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl border py-2 z-10 ${
                            isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                          }`}>
                            <button 
                              onClick={() => { setSelectedHistorySubject('all'); setShowHistoryDropdown(false); }} 
                              className={`w-full text-left px-4 py-2 hover:bg-opacity-50 transition ${
                                isDark ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-200'
                              }`}
                            >
                              All Subjects
                            </button>
                            {subjects.map(subject => (
                              <button 
                                key={subject} 
                                onClick={() => { setSelectedHistorySubject(subject); setShowHistoryDropdown(false); }} 
                                className={`w-full text-left px-4 py-2 hover:bg-opacity-50 transition truncate ${
                                  isDark ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-200'
                                }`}
                              >
                                {subject}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={exportCSV} 
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition active:scale-95"
                        title="Export to CSV"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {filteredSessions.length === 0 ? (
                      <p className={`text-center py-6 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>No sessions recorded</p>
                    ) : (
                      filteredSessions.map(session => (
                        <div 
                          key={session.id} 
                          className={`rounded-lg p-3 border flex justify-between items-start hover:bg-opacity-50 transition ${
                            isDark ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-600' : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className={`font-semibold block truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {session.subject}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>{session.date}</span>
                          </div>
                          <span className={`font-bold text-lg whitespace-nowrap ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {formatDuration(session.duration)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Goal Modal */}
        {showGoalModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className={`backdrop-blur-lg rounded-2xl p-8 border max-w-md w-full ${
              isDark ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-300'
            }`}>
              <h3 className={`text-2xl font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Set Study Goals
              </h3>
              <div className="space-y-6">
                <div>
                  <label className={`block mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Daily Goal (hours)</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={tempDailyGoal}
                    onChange={e => setTempDailyGoal(Math.max(0.5, Number(e.target.value)))}
                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Weekly Goal (hours)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={tempWeeklyGoal}
                    onChange={e => setTempWeeklyGoal(Math.max(1, Number(e.target.value)))}
                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4 mt-8">
                <button 
                  onClick={() => setShowGoalModal(false)} 
                  className="px-6 py-3 bg-red-600/60 hover:bg-red-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveGoals} 
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                >
                  Save Goals
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes spinSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          .animation-delay-4000 { animation-delay: 4s; }
          .animate-slideIn { animation: slideIn 0.3s ease-out; }
          .animate-spin-slow { animation: spinSlow 20s linear infinite; }
        `}</style>
      </div>
    </>
  );
};

export default StudyTimer;