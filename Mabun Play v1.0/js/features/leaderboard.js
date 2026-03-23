// js/features/leaderboard.js
import { showModal } from '../utils/modal.js';
import { formatCurrency } from '../utils/formatters.js';

const elements = {
  typeBtns: document.querySelectorAll('.type-btn'),
  quizName: document.getElementById('quizName'),
  qualifierText: document.getElementById('qualifierText'),
  timeLeft: document.getElementById('timeLeft'),
  prizePool: document.getElementById('prizePool'),
  leaderboardList: document.getElementById('leaderboardList'),
};

let currentType = 'hourly';
let currentData = {
  id: null,               // quiz_id or challenge_id
  prizePool: 0,
  endTime: null,
  leaderboardFunc: null,  // 'get_active_quiz_leaderboard' or 'get_challenge_leaderboard'
  subscriptionTable: null, // 'quiz_sessions' or 'challenge_entries'
  subscriptionFilter: null,
};
let subscriptions = [];
let timerInterval = null;

// Prize distribution percentages (top 10)
const PRIZE_DISTRIBUTION = [
  { rank: 1, percent: 0.30 },
  { rank: 2, percent: 0.20 },
  { rank: 3, percent: 0.15 },
  { rank: 4, percent: 0.05 },
  { rank: 5, percent: 0.05 },
  { rank: 6, percent: 0.05 },
  { rank: 7, percent: 0.05 },
  { rank: 8, percent: 0.05 },
  { rank: 9, percent: 0.05 },
  { rank: 10, percent: 0.05 },
];

function unsubscribeAll() {
  subscriptions.forEach(sub => sub.unsubscribe());
  subscriptions = [];
  if (timerInterval) clearInterval(timerInterval);
}

async function fetchCurrent() {
  const supabase = window.supabaseClient;
  if (!supabase) return;

  try {
    if (currentType === 'hourly') {
      // Find active hourly quiz
      const now = new Date().toISOString();
      const { data: activeQuiz, error } = await supabase
        .from('quizzes')
        .select('id, title, prize_pool, ends_at')
        .eq('type', 'hourly')
        .eq('status', 'active')
        .lte('starts_at', now)
        .gte('ends_at', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (activeQuiz) {
        currentData.id = activeQuiz.id;
        currentData.prizePool = activeQuiz.prize_pool;
        currentData.endTime = activeQuiz.ends_at;
        currentData.leaderboardFunc = 'get_active_quiz_leaderboard';
        currentData.subscriptionTable = 'quiz_sessions';
        currentData.subscriptionFilter = `quiz_id=eq.${activeQuiz.id}`;
        elements.quizName.textContent = activeQuiz.title;
        elements.qualifierText.textContent = 'Live updates – scores refresh after each answer';
        elements.prizePool.textContent = `${activeQuiz.prize_pool.toLocaleString()} Coins`;
        startTimer(activeQuiz.ends_at);
        await fetchLeaderboard();
        subscribeToLeaderboard();
        return;
      }

      // No active quiz → check if we are within 5 minutes of the next quiz
      const { data: nextQuiz } = await supabase
        .from('quizzes')
        .select('starts_at')
        .eq('type', 'hourly')
        .gt('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextQuiz) {
        const nextStart = new Date(nextQuiz.starts_at).getTime();
        const nowTime = Date.now();
        const diffSec = (nextStart - nowTime) / 1000;
        if (diffSec <= 300) { // 5 minutes
          elements.quizName.textContent = 'Next quiz starting soon';
          elements.qualifierText.textContent = 'Leaderboard will appear when the quiz begins';
          elements.prizePool.textContent = '—';
          elements.timeLeft.textContent = '00:00';
          elements.leaderboardList.innerHTML = '<div class="empty-state">Get ready for the next quiz!</div>';
          startTimer(nextQuiz.starts_at);
          return;
        }
      }

      // Otherwise, show final results of the last completed quiz
      const { data: lastQuiz } = await supabase
        .from('quizzes')
        .select('id, title, prize_pool')
        .eq('type', 'hourly')
        .eq('status', 'completed')
        .order('ends_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastQuiz) {
        currentData.id = lastQuiz.id;
        currentData.prizePool = lastQuiz.prize_pool;
        currentData.leaderboardFunc = null; // use view
        elements.quizName.textContent = lastQuiz.title;
        elements.qualifierText.textContent = 'Final results';
        elements.prizePool.textContent = `${lastQuiz.prize_pool.toLocaleString()} Coins`;
        elements.timeLeft.textContent = 'Finished';
        await fetchFinalLeaderboard(lastQuiz.id);
        return;
      }

      // No quizzes at all
      elements.quizName.textContent = 'No quizzes available';
      elements.prizePool.textContent = '0 Coins';
      elements.timeLeft.textContent = '--:--';
      elements.leaderboardList.innerHTML = '<div class="empty-state">Check back later for a quiz!</div>';
    } else {
      // Daily or weekly challenge
      const { data: activeChallenge, error } = await supabase
        .from('challenges')
        .select('id, prize_pool, ends_at')
        .eq('type', currentType)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (activeChallenge) {
        currentData.id = activeChallenge.id;
        currentData.prizePool = activeChallenge.prize_pool;
        currentData.endTime = activeChallenge.ends_at;
        currentData.leaderboardFunc = 'get_challenge_leaderboard';
        currentData.subscriptionTable = 'challenge_entries';
        currentData.subscriptionFilter = `challenge_id=eq.${activeChallenge.id}`;
        elements.quizName.textContent = `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Challenge`;
        elements.qualifierText.textContent = 'Cumulative scores over the period';
        elements.prizePool.textContent = `${activeChallenge.prize_pool.toLocaleString()} Coins`;
        startTimer(activeChallenge.ends_at);
        await fetchLeaderboard();
        subscribeToLeaderboard();
        return;
      }

      // No active challenge – show last completed
      const { data: lastChallenge } = await supabase
        .from('challenges')
        .select('id, prize_pool')
        .eq('type', currentType)
        .eq('status', 'completed')
        .order('ends_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastChallenge) {
        currentData.id = lastChallenge.id;
        currentData.prizePool = lastChallenge.prize_pool;
        elements.quizName.textContent = `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Challenge (Finished)`;
        elements.qualifierText.textContent = 'Final results';
        elements.prizePool.textContent = `${lastChallenge.prize_pool.toLocaleString()} Coins`;
        elements.timeLeft.textContent = 'Ended';
        await fetchFinalLeaderboard(lastChallenge.id);
      } else {
        elements.quizName.textContent = `No ${currentType} challenge`;
        elements.prizePool.textContent = '0 Coins';
        elements.timeLeft.textContent = '--:--';
        elements.leaderboardList.innerHTML = '<div class="empty-state">No active challenge</div>';
      }
    }
  } catch (err) {
    console.error('Error fetching current:', err);
    showModal({ title: 'Error', message: err.message, confirmText: 'OK' });
  }
}

async function fetchLeaderboard() {
  const supabase = window.supabaseClient;
  if (!supabase || !currentData.leaderboardFunc) return;

  try {
    const { data, error } = await supabase.rpc(currentData.leaderboardFunc, {
      p_quiz_id: currentData.id,
      p_challenge_id: currentData.id,
    }[currentData.leaderboardFunc === 'get_active_quiz_leaderboard' ? 'p_quiz_id' : 'p_challenge_id'] = currentData.id);
    if (error) throw error;
    renderLeaderboard(data || []);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    elements.leaderboardList.innerHTML = '<div class="empty-state">Error loading leaderboard</div>';
  }
}

async function fetchFinalLeaderboard(entityId) {
  const supabase = window.supabaseClient;
  if (!supabase) return;

  try {
    let data;
    if (currentType === 'hourly') {
      const { data: d, error } = await supabase
        .from('quiz_leaderboard')
        .select('*')
        .eq('quiz_id', entityId)
        .order('rank', { ascending: true })
        .limit(100);
      if (error) throw error;
      data = d;
    } else {
      const { data: d, error } = await supabase
        .from('challenge_leaderboard')
        .select('*')
        .eq('challenge_id', entityId)
        .order('rank', { ascending: true })
        .limit(100);
      if (error) throw error;
      data = d;
    }
    renderLeaderboard(data || []);
  } catch (err) {
    console.error('Error fetching final leaderboard:', err);
    elements.leaderboardList.innerHTML = '<div class="empty-state">Error loading final results</div>';
  }
}

function renderLeaderboard(players) {
  const listEl = elements.leaderboardList;
  if (!listEl) return;

  if (!players.length) {
    listEl.innerHTML = '<div class="empty-state">No participants yet. Be the first!</div>';
    return;
  }

  // For active quiz, players already have rank; for final, rank is included
  listEl.innerHTML = players.map(player => {
    const rank = player.rank;
    let prize = 0;
    const dist = PRIZE_DISTRIBUTION.find(d => d.rank === rank);
    if (dist) prize = Math.floor(currentData.prizePool * dist.percent);
    const score = player.score || player.total_score;
    return `
      <div class="leaderboard-item">
        <div class="rank rank-${rank}">
          ${rank === 1 ? '<iconify-icon icon="solar:medal-star-bold"></iconify-icon>' :
            rank === 2 ? '<iconify-icon icon="solar:medal-ribbon-bold"></iconify-icon>' :
            rank === 3 ? '<iconify-icon icon="solar:medal-ribbon-bold"></iconify-icon>' : rank}
        </div>
        <div class="avatar">
          <img src="${player.avatar_url || '/assets/images/default-avatar.png'}" alt="${escapeHtml(player.username)}">
        </div>
        <div class="player-info">
          <div class="player-name">${escapeHtml(player.username)}</div>
        </div>
        <div class="score-prize">
          <span class="score">${score} pts</span>
          ${prize > 0 ? `<span class="prize">${prize.toLocaleString()} Coins</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function startTimer(endTimeISO) {
  if (timerInterval) clearInterval(timerInterval);
  const endTime = new Date(endTimeISO).getTime();
  timerInterval = setInterval(() => {
    const now = Date.now();
    const diff = endTime - now;
    if (diff <= 0) {
      elements.timeLeft.textContent = '00:00';
      clearInterval(timerInterval);
      fetchCurrent(); // refresh to show final results
      return;
    }
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    elements.timeLeft.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

function subscribeToLeaderboard() {
  unsubscribeAll();
  if (!currentData.subscriptionTable) return;

  const supabase = window.supabaseClient;
  const subscription = supabase
    .channel(`leaderboard-${currentData.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: currentData.subscriptionTable,
        filter: currentData.subscriptionFilter,
      },
      () => {
        fetchLeaderboard();
      }
    )
    .subscribe();
  subscriptions.push(subscription);
}

async function switchType(type) {
  currentType = type;
  elements.typeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  await fetchCurrent();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// Initialization
(async function init() {
  let retries = 0;
  while (!window.supabaseClient && retries < 20) {
    await new Promise(r => setTimeout(r, 50));
    retries++;
  }
  if (!window.supabaseClient) {
    console.error('Supabase client not available');
    return;
  }

  elements.typeBtns.forEach(btn => {
    btn.addEventListener('click', () => switchType(btn.dataset.type));
  });

  await switchType('hourly');
})();
