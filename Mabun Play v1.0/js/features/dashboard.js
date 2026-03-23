// js/features/dashboard.js
import { showModal } from '../utils/modal.js';
import { formatCurrency } from '../utils/formatters.js';

// DOM elements
const elements = {
  walletAmount: document.getElementById('wallet-amount'),
  coinBalance: document.getElementById('coin-balance'),
  statCoins: document.getElementById('stat-coins-value'),
  userName: document.getElementById('user-name'),
  liveTimer: document.getElementById('live-timer'),
  nextQuizTimer: document.getElementById('next-quiz-timer'),
  liveQuizTitle: document.getElementById('live-quiz-title'),
  hourlyPrize: document.getElementById('hourly-prize'),
  dailyPrize: document.getElementById('daily-prize'),
  weeklyPrize: document.getElementById('weekly-prize'),
  todayDate: document.getElementById('today-date'),
  weeklyCountdown: document.getElementById('weekly-countdown'),
  weeklyPayoutCountdown: document.getElementById('weekly-payout-countdown'),
  dailyPayoutCountdown: document.getElementById('daily-payout-countdown'),
  statPlayed: document.getElementById('stat-played-value'),
  statWinnings: document.getElementById('stat-winnings-value'),
  statRank: document.getElementById('stat-rank-value'),
  joinBtn: document.getElementById('join-hourly-quiz'),
  dailyChallengeBtn: document.querySelector('.js-challenge-entry[data-challenge="daily"]'),
  weeklyChallengeBtn: document.querySelector('.js-challenge-entry[data-challenge="weekly"]'),
  subscribeBtn: document.getElementById('subscribe-btn'),
};

let state = {
  user: { name: 'User', wallet: 0, coins: 0, played: 0, winnings: 0, rank: 0 },
  liveQuiz: { id: null, title: 'No active quiz', prizePool: 0, startsAt: null, endsAt: null, canJoin: false, hasPaid: false },
  nextQuizStartsAt: null,
  dailyChallenge: { prizePool: 0, payoutTime: null, hasEntered: false },
  weeklyChallenge: { prizePool: 0, endsAt: null, payoutTime: null, hasEntered: false },
  autoSubscribe: false,
};

let quizSubscription = null;
let timerInterval = null;

function showToast(title, message, icon = 'success') {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title: message,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
  });
}

async function fetchDashboard() {
  const supabase = window.supabaseClient;
  // Complete any expired challenges
await supabase.rpc('complete_expired_challenges');
  if (!supabase) {
    console.error('Supabase client not available');
    showModal({ title: 'Error', message: 'Supabase client not loaded. Please refresh.', confirmText: 'OK' });
    return;
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Not authenticated');

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, winnings, played, rank, wallet_balance, coins_balance')
      .eq('id', user.id)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        console.log('Profile missing, redirecting to complete-profile');
        window.location.href = 'complete-profile.html';
        return;
      }
      throw profileError;
    }

    state.user.name = profile.username;
    state.user.winnings = profile.winnings || 0;
    state.user.played = profile.played || 0;
    state.user.rank = profile.rank || 0;
    state.user.wallet = profile.wallet_balance || 0;
    state.user.coins = profile.coins_balance || 15000;

    const now = new Date().toISOString();

    // ----- Live Hourly Quiz -----
    const { data: activeQuiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, title, prize_pool, starts_at, ends_at')
      .eq('type', 'hourly')
      .eq('status', 'active')
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (quizError) throw quizError;

    if (activeQuiz) {
      // Check if user already joined
      const { data: session } = await supabase
        .from('quiz_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('quiz_id', activeQuiz.id)
        .eq('status', 'active')
        .maybeSingle();

      state.liveQuiz = {
        id: activeQuiz.id,
        title: activeQuiz.title,
        prizePool: activeQuiz.prize_pool,
        startsAt: activeQuiz.starts_at,
        endsAt: activeQuiz.ends_at,
        canJoin: true,
        hasPaid: !!session,
      };
      if (session) state.liveQuiz.canJoin = false; // already joined
    } else {
      state.liveQuiz = {
        id: null,
        title: 'No active quiz',
        prizePool: 0,
        startsAt: null,
        endsAt: null,
        canJoin: false,
        hasPaid: false,
      };
    }

    // ----- Next Quiz (always fetch, even if active) -----
    const { data: nextQuiz } = await supabase
      .from('quizzes')
      .select('starts_at')
      .eq('type', 'hourly')
      .gt('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    state.nextQuizStartsAt = nextQuiz ? nextQuiz.starts_at : null;

    // ----- Daily Challenge -----
    const { data: daily, error: dailyError } = await supabase
      .from('challenges')
      .select('prize_pool, payout_time')
      .eq('type', 'daily')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!dailyError && daily) {
      state.dailyChallenge.prizePool = daily.prize_pool;
      state.dailyChallenge.payoutTime = daily.payout_time;
      const { data: entry } = await supabase
        .from('challenge_entries')
        .select('id')
        .eq('challenge_type', 'daily')
        .eq('user_id', user.id)
        .maybeSingle();
      if (entry) state.dailyChallenge.hasEntered = true;
    }

    // ----- Weekly Challenge -----
    const { data: weekly, error: weeklyError } = await supabase
      .from('challenges')
      .select('prize_pool, ends_at, payout_time')
      .eq('type', 'weekly')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!weeklyError && weekly) {
      state.weeklyChallenge.prizePool = weekly.prize_pool;
      state.weeklyChallenge.endsAt = weekly.ends_at;
      state.weeklyChallenge.payoutTime = weekly.payout_time;
      const { data: entry } = await supabase
        .from('challenge_entries')
        .select('id')
        .eq('challenge_type', 'weekly')
        .eq('user_id', user.id)
        .maybeSingle();
      if (entry) state.weeklyChallenge.hasEntered = true;
    }

    // ----- Auto-Subscribe -----
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'daily')
      .maybeSingle();
    if (sub) state.autoSubscribe = true;

    renderAll();
    startTimers();

    // Subscribe to real‑time updates for the active quiz (if any)
    if (state.liveQuiz.id) {
      if (quizSubscription) quizSubscription.unsubscribe();
      quizSubscription = supabase
        .channel(`quiz-${state.liveQuiz.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'quizzes',
            filter: `id=eq.${state.liveQuiz.id}`,
          },
          (payload) => {
            if (payload.new.prize_pool !== undefined) state.liveQuiz.prizePool = payload.new.prize_pool;
            if (payload.new.ends_at !== undefined) state.liveQuiz.endsAt = payload.new.ends_at;
            renderLiveQuiz();
          }
        )
        .subscribe();
    }
  } catch (err) {
    console.error('Dashboard error:', err);
    showModal({ title: 'Error', message: err.message || 'Could not load dashboard.', confirmText: 'OK' });
  }
}

function renderAll() {
  renderUser();
  renderLiveQuiz();
  renderDaily();
  renderWeekly();
  renderSubscribeButton();
  updateButtonStates();
}

function renderUser() {
  if (elements.walletAmount) elements.walletAmount.textContent = state.user.wallet.toFixed(2);
  if (elements.coinBalance) elements.coinBalance.textContent = state.user.coins;
  if (elements.statCoins) elements.statCoins.textContent = state.user.coins;
  if (elements.userName) elements.userName.textContent = state.user.name;
  if (elements.statPlayed) elements.statPlayed.textContent = state.user.played;
  if (elements.statWinnings) elements.statWinnings.textContent = formatCurrency(state.user.winnings, true);
  if (elements.statRank) elements.statRank.textContent = '#' + state.user.rank;
}

function updateJoinButtonText() {
  if (!elements.joinBtn) return;

  const now = Date.now();

  // Active quiz exists
  if (state.liveQuiz.id && state.liveQuiz.endsAt) {
    const endTime = new Date(state.liveQuiz.endsAt).getTime();
    if (now <= endTime) { // quiz still active
      if (state.liveQuiz.hasPaid) {
        elements.joinBtn.textContent = 'Continue Quiz';
        elements.joinBtn.disabled = false;
      } else {
        elements.joinBtn.textContent = 'Join Now (100 Coins)';
        elements.joinBtn.disabled = !state.liveQuiz.canJoin;
      }
      return;
    }
  }

  // No active quiz, but there is a future quiz
  if (state.nextQuizStartsAt) {
    const startTime = new Date(state.nextQuizStartsAt).getTime();
    if (now < startTime) {
      const diffSec = Math.floor((startTime - now) / 1000);
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      elements.joinBtn.textContent = `Starts in ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      elements.joinBtn.disabled = true;
      return;
    }
  }

  // No active quiz and no future quiz
  elements.joinBtn.textContent = 'No upcoming quiz';
  elements.joinBtn.disabled = true;
}

function renderLiveQuiz() {
  if (elements.liveQuizTitle) elements.liveQuizTitle.textContent = state.liveQuiz.title;
  if (elements.hourlyPrize) elements.hourlyPrize.textContent = `${state.liveQuiz.prizePool.toLocaleString()} Coins`;
  updateJoinButtonText();
}

function renderDaily() {
  if (elements.dailyPrize) elements.dailyPrize.textContent = `${state.dailyChallenge.prizePool.toLocaleString()} Coins`;
  if (elements.todayDate) elements.todayDate.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  if (elements.dailyChallengeBtn) elements.dailyChallengeBtn.textContent = state.dailyChallenge.hasEntered ? 'Entered' : 'Enter Challenge';
}

function renderWeekly() {
  if (elements.weeklyPrize) elements.weeklyPrize.textContent = `${state.weeklyChallenge.prizePool.toLocaleString()} Coins`;
  if (elements.weeklyChallengeBtn) elements.weeklyChallengeBtn.textContent = state.weeklyChallenge.hasEntered ? 'Entered' : 'Enter Challenge';
}

function renderSubscribeButton() {
  if (!elements.subscribeBtn) return;
  elements.subscribeBtn.textContent = state.autoSubscribe ? 'Subscribed (Daily)' : 'Subscribe Now';
  elements.subscribeBtn.disabled = state.autoSubscribe;
}

function updateButtonStates() {
  updateJoinButtonText();
  if (elements.dailyChallengeBtn) elements.dailyChallengeBtn.disabled = state.dailyChallenge.hasEntered;
  if (elements.weeklyChallengeBtn) elements.weeklyChallengeBtn.disabled = state.weeklyChallenge.hasEntered;
}

function startTimers() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const now = Date.now();

    // Live quiz remaining time
    if (state.liveQuiz.endsAt && elements.liveTimer) {
      const endTime = new Date(state.liveQuiz.endsAt).getTime();
      const diff = Math.max(0, endTime - now);
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      elements.liveTimer.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;

      // If the active quiz just ended, refetch dashboard to load the next one
      if (diff === 0 && state.liveQuiz.id) {
        fetchDashboard();
      }
    } else if (elements.liveTimer) {
      elements.liveTimer.textContent = '00:00';
    }

    // Next quiz countdown (separate display, but we also update button)
    if (state.nextQuizStartsAt && elements.nextQuizTimer) {
      const startTime = new Date(state.nextQuizStartsAt).getTime();
      const diff = Math.max(0, startTime - now);
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      elements.nextQuizTimer.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    } else if (elements.nextQuizTimer) {
      elements.nextQuizTimer.textContent = '--:--';
    }

    // Update button text every second (countdown on button)
    updateJoinButtonText();

    // Daily/Weekly payout countdowns
    if (state.dailyChallenge.payoutTime && elements.dailyPayoutCountdown) {
      const payoutTime = new Date(state.dailyChallenge.payoutTime).getTime();
      const diff = Math.max(0, payoutTime - now);
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      elements.dailyPayoutCountdown.textContent = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }

    if (state.weeklyChallenge.endsAt && elements.weeklyCountdown) {
      const endsAt = new Date(state.weeklyChallenge.endsAt).getTime();
      const diff = Math.max(0, endsAt - now);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      elements.weeklyCountdown.textContent = `${days}d ${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }

    if (state.weeklyChallenge.payoutTime && elements.weeklyPayoutCountdown) {
      const payoutTime = new Date(state.weeklyChallenge.payoutTime).getTime();
      const diff = Math.max(0, payoutTime - now);
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      elements.weeklyPayoutCountdown.textContent = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }
  }, 1000);
}

async function handleJoinQuiz() {
  if (!state.liveQuiz.id) {
    await showModal({ title: 'No Active Quiz', message: 'There is no active quiz at the moment.', confirmText: 'OK' });
    return;
  }

  try {
    const supabase = window.supabaseClient;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('join_live_quiz', {
      p_quiz_id: state.liveQuiz.id,
      p_user_id: user.id
    });
    if (error) throw error;
    if (data.error) {
      if (data.error === 'Already joined') {
        window.location.href = `quiz.html?id=${state.liveQuiz.id}&session=${data.session_id}`;
        return;
      }
      if (data.error === 'Quiz has not started') {
        const startTime = new Date(state.liveQuiz.startsAt).getTime();
        const now = Date.now();
        const diffSec = Math.max(0, Math.floor((startTime - now) / 1000));
        const mins = Math.floor(diffSec / 60);
        const secs = diffSec % 60;
        await showModal({
          title: 'Quiz Not Started',
          message: `This quiz will start in ${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}. Please wait.`,
          confirmText: 'OK'
        });
        return;
      }
      throw new Error(data.error);
    }

    const sessionId = data.session_id;
    window.location.href = `quiz.html?id=${state.liveQuiz.id}&session=${sessionId}`;
  } catch (err) {
    console.error(err);
    if (err.message === 'Insufficient coins') {
      await showModal({
        title: 'Insufficient Coins',
        message: 'You need more Mabun coins to join this quiz.',
        confirmText: 'OK'
      });
    } else {
      await showModal({ title: 'Join Failed', message: err.message || 'Could not join quiz.', confirmText: 'OK' });
    }
  }
}

async function handleChallengeEntry(e) {
  e.preventDefault();
  const btn = e.currentTarget;
  const challenge = btn.dataset.challenge;

  if ((challenge === 'daily' && state.dailyChallenge.hasEntered) ||
      (challenge === 'weekly' && state.weeklyChallenge.hasEntered)) {
    return;
  }

  try {
    btn.disabled = true;
    const supabase = window.supabaseClient;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc('enter_challenge', {
      p_challenge_type: challenge,
      p_user_id: user.id
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);

    state.user.coins = data.new_balance;
    renderUser();

    if (challenge === 'daily') state.dailyChallenge.hasEntered = true;
    else state.weeklyChallenge.hasEntered = true;
    renderAll();
    showToast('Success', `You have entered the ${challenge} challenge!`, 'success');
  } catch (err) {
    console.error(err);
    if (err.message === 'Insufficient coins') {
      await showModal({
        title: 'Insufficient Coins',
        message: 'You need more Mabun coins to enter this challenge.',
        confirmText: 'OK'
      });
    } else if (err.message === 'Already entered for this period') {
      await showModal({
        title: 'Already Entered',
        message: `You have already entered the ${challenge} challenge for this period.`,
        confirmText: 'OK'
      });
    } else {
      await showModal({
        title: 'Entry Failed',
        message: err?.message || 'Could not enter challenge.',
        confirmText: 'OK'
      });
    }
  } finally {
    btn.disabled = false;
  }
}

async function handleSubscribe() {
  await showModal({ title: 'Coming Soon', message: 'Subscription feature is not yet available.', confirmText: 'OK' });
}

function init() {
  fetchDashboard();
  if (elements.joinBtn) elements.joinBtn.addEventListener('click', handleJoinQuiz);
  if (elements.dailyChallengeBtn) elements.dailyChallengeBtn.addEventListener('click', handleChallengeEntry);
  if (elements.weeklyChallengeBtn) elements.weeklyChallengeBtn.addEventListener('click', handleChallengeEntry);
  if (elements.subscribeBtn) elements.subscribeBtn.addEventListener('click', handleSubscribe);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
