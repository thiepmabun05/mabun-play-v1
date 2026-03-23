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
  id: null,               // for hourly: current quiz ID
  prizePool: 0,
  endTime: null,
  leaderboardTable: null, // 'quiz_leaderboard' or 'challenge_leaderboard'
  filterField: null,     // 'quiz_id' or 'challenge_type'
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
      // Get the most recent active hourly quiz
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, prize_pool, ends_at')
        .eq('type', 'hourly')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        currentData.id = data.id;
        currentData.prizePool = data.prize_pool;
        currentData.endTime = data.ends_at;
        currentData.leaderboardTable = 'quiz_leaderboard';
        currentData.filterField = 'quiz_id';
        elements.quizName.textContent = data.title;
        elements.qualifierText.textContent = 'Live updates – scores refresh after each answer';
      } else {
        elements.quizName.textContent = 'No active quiz';
        elements.prizePool.textContent = formatCurrency(0);
        elements.timeLeft.textContent = '--:--';
        elements.leaderboardList.innerHTML = '<div class="empty-state">No active hourly quiz</div>';
        return;
      }
    } else {
      // Daily or weekly challenge – get the most recent challenge of that type
      const { data, error } = await supabase
        .from('challenges')
        .select('prize_pool, ends_at')
        .eq('type', currentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        currentData.id = null;
        currentData.prizePool = data.prize_pool;
        currentData.endTime = data.ends_at;
        currentData.leaderboardTable = 'challenge_leaderboard';
        currentData.filterField = 'challenge_type';
        elements.quizName.textContent = `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Challenge`;
        elements.qualifierText.textContent = 'Cumulative scores over the period';
      } else {
        elements.quizName.textContent = 'No active challenge';
        elements.prizePool.textContent = formatCurrency(0);
        elements.timeLeft.textContent = '--:--';
        elements.leaderboardList.innerHTML = '<div class="empty-state">No active challenge</div>';
        return;
      }
    }

    elements.prizePool.textContent = `${currentData.prizePool.toLocaleString()} Coins`;
    startTimer(currentData.endTime);
    await fetchLeaderboard();
    subscribeToLeaderboard();
  } catch (err) {
    console.error('Error fetching current:', err);
    showModal({ title: 'Error', message: err.message, confirmText: 'OK' });
  }
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
      return;
    }
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    elements.timeLeft.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

async function fetchLeaderboard() {
  const supabase = window.supabaseClient;
  if (!supabase || !currentData.leaderboardTable) return;

  try {
    const orderColumn = currentData.leaderboardTable === 'quiz_leaderboard' ? 'score' : 'total_score';
    let query = supabase
      .from(currentData.leaderboardTable)
      .select('*')
      .order(orderColumn, { ascending: false })
      .limit(100);

    if (currentData.filterField === 'quiz_id') {
      query = query.eq('quiz_id', currentData.id);
    } else {
      query = query.eq('challenge_type', currentType);
    }

    const { data, error } = await query;
    if (error) throw error;
    renderLeaderboard(data || []);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    elements.leaderboardList.innerHTML = '<div class="empty-state">Error loading leaderboard</div>';
  }
}

function renderLeaderboard(players) {
  const listEl = elements.leaderboardList;
  if (!listEl) return;

  if (!players.length) {
    listEl.innerHTML = '<div class="empty-state">No participants yet. Be the first!</div>';
    return;
  }

  const scoreKey = currentData.leaderboardTable === 'quiz_leaderboard' ? 'score' : 'total_score';

  const ranked = players.map((player, idx) => {
    const rank = idx + 1;
    let prize = 0;
    const dist = PRIZE_DISTRIBUTION.find(d => d.rank === rank);
    if (dist) prize = Math.floor(currentData.prizePool * dist.percent);
    const score = player[scoreKey];
    return { ...player, rank, prize, score };
  });

  listEl.innerHTML = ranked.map(player => `
    <div class="leaderboard-item">
      <div class="rank rank-${player.rank}">
        ${player.rank === 1 ? '<iconify-icon icon="solar:medal-star-bold"></iconify-icon>' : 
          player.rank === 2 ? '<iconify-icon icon="solar:medal-ribbon-bold"></iconify-icon>' :
          player.rank === 3 ? '<iconify-icon icon="solar:medal-ribbon-bold"></iconify-icon>' : player.rank}
      </div>
      <div class="avatar">
        <img src="${player.avatar_url || '/assets/images/default-avatar.png'}" alt="${escapeHtml(player.username)}">
      </div>
      <div class="player-info">
        <div class="player-name">${escapeHtml(player.username)}</div>
      </div>
      <div class="score-prize">
        <span class="score">${player.score} pts</span>
        ${player.prize > 0 ? `<span class="prize">${player.prize.toLocaleString()} Coins</span>` : ''}
      </div>
    </div>
  `).join('');
}

function subscribeToLeaderboard() {
  unsubscribeAll();
  if (!currentData.leaderboardTable) return;

  const supabase = window.supabaseClient;
  let channelName = `leaderboard-${currentType}`;
  let filter = currentData.filterField === 'quiz_id' ? `quiz_id=eq.${currentData.id}` : `challenge_type=eq.${currentType}`;

  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: currentData.leaderboardTable,
        filter: filter,
      },
      () => {
        fetchLeaderboard();  // re-fetch on any change
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Initialization
(async function init() {
  // Wait for Supabase client
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
