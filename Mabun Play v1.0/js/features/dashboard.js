import { showModal } from '../utils/modal.js';
import { formatCurrency } from '../utils/formatters.js';

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

async function fetchDashboard() {
  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error('Supabase client not available');
    return;
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Not authenticated');
    console.log('Authenticated user:', user);

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, winnings, played, rank, wallet_balance')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.warn('Profile not found or error:', profileError);
    } else if (profile) {
      state.user.name = profile.username;
      state.user.winnings = profile.winnings || 0;
      state.user.played = profile.played || 0;
      state.user.rank = profile.rank || 0;
      state.user.wallet = profile.wallet_balance || 0;
    }

    // Fetch live quiz (hourly)
    const { data: liveQuiz, error: liveError } = await supabase
      .from('quizzes')
      .select('id, title, prize_pool, current_quiz_ends_at, next_quiz_starts_at')
      .eq('type', 'hourly')
      .eq('status', 'active')
      .maybeSingle();

    if (!liveError && liveQuiz) {
      state.liveQuiz.id = liveQuiz.id;
      state.liveQuiz.title = liveQuiz.title;
      state.liveQuiz.prizePool = liveQuiz.prize_pool;
      state.liveQuiz.currentQuizEndsAt = liveQuiz.current_quiz_ends_at;
      state.liveQuiz.nextQuizStartsAt = liveQuiz.next_quiz_starts_at;
      state.liveQuiz.canPay = true;
      state.liveQuiz.canJoin = true;
    } else {
      console.log('No active hourly quiz found');
    }

    // Fetch daily challenge
    const { data: daily, error: dailyError } = await supabase
      .from('challenges')
      .select('prize_pool, payout_time')
      .eq('type', 'daily')
      .maybeSingle();

    if (!dailyError && daily) {
      state.dailyChallenge.prizePool = daily.prize_pool;
      state.dailyChallenge.payoutTime = daily.payout_time;
      // Check entry
      const { data: entry, error: entryError } = await supabase
        .from('challenge_entries')
        .select('id')
        .eq('challenge_type', 'daily')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!entryError && entry) state.dailyChallenge.hasEntered = true;
    }

    // Fetch weekly challenge
    const { data: weekly, error: weeklyError } = await supabase
      .from('challenges')
      .select('prize_pool, ends_at, payout_time')
      .eq('type', 'weekly')
      .maybeSingle();

    if (!weeklyError && weekly) {
      state.weeklyChallenge.prizePool = weekly.prize_pool;
      state.weeklyChallenge.endsAt = weekly.ends_at;
      state.weeklyChallenge.payoutTime = weekly.payout_time;
      const { data: entry, error: entryError } = await supabase
        .from('challenge_entries')
        .select('id')
        .eq('challenge_type', 'weekly')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!entryError && entry) state.weeklyChallenge.hasEntered = true;
    }

    // Check auto-subscribe
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'daily')
      .maybeSingle();
    if (!subError && sub) state.autoSubscribe = true;

    renderAll();
    updateTimers();
  } catch (err) {
    console.error('Dashboard fetch error:', err);
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
}

async function handleJoinQuiz() {
  if (!state.liveQuiz.canJoin) {
    await showModal({ title: 'Cannot Join', message: 'Joining is not available at this time.', confirmText: 'OK' });
    return;
  }

  try {
    const supabase = window.supabaseClient;
    const { data: { user } } = await supabase.auth.getUser();

    // Get total questions for this quiz
    const { count, error: countError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', state.liveQuiz.id);
    if (countError) throw countError;

    const { data: session, error } = await supabase
      .from('quiz_sessions')
      .insert({
        quiz_id: state.liveQuiz.id,
        user_id: user.id,
        status: 'active',
        started_at: new Date().toISOString(),
        total_questions: count,
        current_question_index: 0,
        score: 0,
        streak: 0
      })
      .select()
      .single();
    if (error) throw error;

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

  const supabase = window.supabaseClient;
  if (!supabase) {
    await showModal({ title: 'Error', message: 'Supabase client not available.', confirmText: 'OK' });
    return;
  }

  try {
    btn.disabled = true;
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
