// js/features/dashboard.js
import { showModal } from '../utils/modal.js';
import { formatCurrency } from '../utils/formatters.js';

// DOM elements
const elements = {
  walletAmount: document.getElementById('wallet-amount'),
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
  payBtn: document.getElementById('pay-entry-fee'),
  joinBtn: document.getElementById('join-hourly-quiz'),
  dailyChallengeBtn: document.querySelector('.js-challenge-entry[data-challenge="daily"]'),
  weeklyChallengeBtn: document.querySelector('.js-challenge-entry[data-challenge="weekly"]'),
  subscribeBtn: document.getElementById('subscribe-btn'),
};

let state = {
  user: { name: 'User', wallet: 0, played: 0, winnings: 0, rank: 0 },
  liveQuiz: { id: null, title: 'General Knowledge', prizePool: 0, currentQuizEndsAt: null, nextQuizStartsAt: null, hasPaid: false, canJoin: false, canPay: false },
  dailyChallenge: { prizePool: 0, payoutTime: null, hasEntered: false },
  weeklyChallenge: { prizePool: 0, endsAt: null, payoutTime: null, hasEntered: false },
  autoSubscribe: false,
};

// Subscriptions (to be stored for cleanup)
let quizSubscription = null;

// Helper toast
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
  if (!supabase) {
    console.error('Supabase client not available');
    showModal({ title: 'Error', message: 'Supabase client not loaded. Please refresh.', confirmText: 'OK' });
    return;
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Not authenticated');

    // Profile uses 'id' column
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, winnings, played, rank, wallet_balance')
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

    // Live quiz (hourly)
    const { data: liveQuiz, error: liveError } = await supabase
      .from('quizzes')
      .select('id, title, prize_pool, current_quiz_ends_at, next_quiz_starts_at, status, participant_count')
      .eq('type', 'hourly')
      .eq('status', 'active')
      .maybeSingle();

    if (!liveError && liveQuiz) {
      state.liveQuiz = {
        id: liveQuiz.id,
        title: liveQuiz.title,
        prizePool: liveQuiz.prize_pool,
        currentQuizEndsAt: liveQuiz.current_quiz_ends_at,
        nextQuizStartsAt: liveQuiz.next_quiz_starts_at,
        canPay: true,
        canJoin: true,
        hasPaid: false,
        participantCount: liveQuiz.participant_count,
      };
    } else {
      // Fallback quiz (hardcoded ID)
      state.liveQuiz = {
        id: '7c3f555e-c397-4fbb-8667-3bdd5fa23f40',
        title: 'General Knowledge Hourly',
        prizePool: 10000,
        currentQuizEndsAt: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
        nextQuizStartsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        canPay: true,
        canJoin: true,
        hasPaid: false,
        participantCount: 0,
      };
    }

    // Daily challenge
    const { data: daily, error: dailyError } = await supabase
      .from('challenges')
      .select('prize_pool, payout_time')
      .eq('type', 'daily')
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

    // Weekly challenge
    const { data: weekly, error: weeklyError } = await supabase
      .from('challenges')
      .select('prize_pool, ends_at, payout_time')
      .eq('type', 'weekly')
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

    // Auto-subscribe
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'daily')
      .maybeSingle();
    if (sub) state.autoSubscribe = true;

    renderAll();
    updateTimers();

    // Subscribe to live quiz updates
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
            // Update prize pool, timers, and participant count
            if (payload.new.prize_pool !== undefined) state.liveQuiz.prizePool = payload.new.prize_pool;
            if (payload.new.current_quiz_ends_at !== undefined) state.liveQuiz.currentQuizEndsAt = payload.new.current_quiz_ends_at;
            if (payload.new.next_quiz_starts_at !== undefined) state.liveQuiz.nextQuizStartsAt = payload.new.next_quiz_starts_at;
            if (payload.new.participant_count !== undefined) state.liveQuiz.participantCount = payload.new.participant_count;
            renderLiveQuiz();
            updateTimers();
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
  if (elements.userName) elements.userName.textContent = state.user.name;
  if (elements.statPlayed) elements.statPlayed.textContent = state.user.played;
  if (elements.statWinnings) elements.statWinnings.textContent = formatCurrency(state.user.winnings, true);
  if (elements.statRank) elements.statRank.textContent = '#' + state.user.rank;
}

function renderLiveQuiz() {
  if (elements.liveQuizTitle) elements.liveQuizTitle.textContent = state.liveQuiz.title;
  if (elements.hourlyPrize) elements.hourlyPrize.textContent = formatCurrency(state.liveQuiz.prizePool);
  if (elements.payBtn) elements.payBtn.textContent = 'Free Entry';
  // Optional: display participant count somewhere
}

function renderDaily() {
  if (elements.dailyPrize) elements.dailyPrize.textContent = formatCurrency(state.dailyChallenge.prizePool);
  if (elements.todayDate) elements.todayDate.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  if (elements.dailyChallengeBtn) elements.dailyChallengeBtn.textContent = state.dailyChallenge.hasEntered ? 'Entered' : 'Enter Challenge';
}

function renderWeekly() {
  if (elements.weeklyPrize) elements.weeklyPrize.textContent = formatCurrency(state.weeklyChallenge.prizePool);
  if (elements.weeklyChallengeBtn) elements.weeklyChallengeBtn.textContent = state.weeklyChallenge.hasEntered ? 'Entered' : 'Enter Challenge';
}

function renderSubscribeButton() {
  if (!elements.subscribeBtn) return;
  elements.subscribeBtn.textContent = state.autoSubscribe ? 'Subscribed (Daily)' : 'Subscribe Now';
  elements.subscribeBtn.disabled = state.autoSubscribe;
}

function updateTimers() {
  const now = Date.now();
  if (elements.liveTimer && state.liveQuiz.currentQuizEndsAt) {
    const endTime = new Date(state.liveQuiz.currentQuizEndsAt).getTime();
    const diff = Math.max(0, endTime - now);
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    elements.liveTimer.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  } else if (elements.liveTimer) elements.liveTimer.textContent = '00:00';

  if (elements.nextQuizTimer && state.liveQuiz.nextQuizStartsAt) {
    const startTime = new Date(state.liveQuiz.nextQuizStartsAt).getTime();
    const diff = Math.max(0, startTime - now);
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    elements.nextQuizTimer.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  }

  if (elements.dailyPayoutCountdown && state.dailyChallenge.payoutTime) {
    const payoutTime = new Date(state.dailyChallenge.payoutTime).getTime();
    const diff = Math.max(0, payoutTime - now);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    elements.dailyPayoutCountdown.textContent = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  }

  if (elements.weeklyCountdown && state.weeklyChallenge.endsAt) {
    const endsAt = new Date(state.weeklyChallenge.endsAt).getTime();
    const diff = Math.max(0, endsAt - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    elements.weeklyCountdown.textContent = `${days}d ${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  }

  if (elements.weeklyPayoutCountdown && state.weeklyChallenge.payoutTime) {
    const payoutTime = new Date(state.weeklyChallenge.payoutTime).getTime();
    const diff = Math.max(0, payoutTime - now);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    elements.weeklyPayoutCountdown.textContent = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  }
}

function updateButtonStates() {
  if (elements.payBtn) elements.payBtn.disabled = false;
  if (elements.joinBtn) elements.joinBtn.disabled = !state.liveQuiz.canJoin;
  if (elements.dailyChallengeBtn) elements.dailyChallengeBtn.disabled = state.dailyChallenge.hasEntered;
  if (elements.weeklyChallengeBtn) elements.weeklyChallengeBtn.disabled = state.weeklyChallenge.hasEntered;
}

async function handlePayEntry() {
  state.liveQuiz.hasPaid = true;
  state.liveQuiz.canJoin = true;
  renderLiveQuiz();
  updateButtonStates();
  showToast('Free Entry', 'You can now join the quiz for free!', 'success');
}

async function handleJoinQuiz() {
  if (!state.liveQuiz.canJoin) {
    await showModal({ title: 'Cannot Join', message: 'Joining is not available at this time.', confirmText: 'OK' });
    return;
  }

  try {
    const supabase = window.supabaseClient;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('join_quiz', {
      p_quiz_id: state.liveQuiz.id,
      p_user_id: user.id
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);

    const session = data.session;
    window.location.href = `quiz.html?id=${state.liveQuiz.id}&session=${session.id}`;
  } catch (err) {
    console.error(err);
    await showModal({ title: 'Join Failed', message: err.message || 'Could not join quiz.', confirmText: 'OK' });
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
    const { error } = await supabase
      .from('challenge_entries')
      .insert({
        challenge_type: challenge,
        user_id: user.id,
        entered_at: new Date().toISOString(),
      });
    if (error) throw error;

    if (challenge === 'daily') state.dailyChallenge.hasEntered = true;
    else state.weeklyChallenge.hasEntered = true;
    renderAll();
    showToast('Success', `You have entered the ${challenge} challenge!`, 'success');
  } catch (err) {
    console.error(err);
    await showModal({
      title: 'Entry Failed',
      message: err?.message || 'Could not enter challenge.',
      confirmText: 'OK'
    });
  } finally {
    btn.disabled = false;
  }
}

async function handleSubscribe() {
  await showModal({ title: 'Coming Soon', message: 'Subscription feature is not yet available.', confirmText: 'OK' });
}

function init() {
  fetchDashboard();
  setInterval(updateTimers, 1000);
  if (elements.payBtn) elements.payBtn.addEventListener('click', handlePayEntry);
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
