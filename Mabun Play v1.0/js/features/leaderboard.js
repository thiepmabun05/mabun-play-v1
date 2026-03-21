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
  loadingSpinner: document.getElementById('loadingSpinner'),
  loadMoreContainer: document.getElementById('loadMoreContainer'),
  loadMoreBtn: document.getElementById('loadMoreBtn'),
};

let currentType = 'hourly';
let currentQuizId = null;
let currentPrizePool = 0;
let currentEndTime = null;
let leaderboardSubscription = null;
let quizSubscription = null;
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

async function fetchCurrentQuiz() {
  try {
    const supabase = window.supabaseClient;
    const { data, error } = await supabase
      .from('quizzes')
      .select('id, title, prize_pool, next_question_at')
      .eq('type', currentType)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;

    if (data) {
      currentQuizId = data.id;
      elements.quizName.textContent = data.title;
      currentPrizePool = data.prize_pool;
      elements.prizePool.textContent = formatCurrency(currentPrizePool);
      currentEndTime = data.next_question_at;
      startTimer(currentEndTime);
    } else {
      // No active quiz of this type
      elements.quizName.textContent = 'No active quiz';
      elements.prizePool.textContent = formatCurrency(0);
      elements.timeLeft.textContent = '--:--';
    }
  } catch (err) {
    console.error('Error fetching current quiz:', err);
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
  if (!currentQuizId) return;
  const supabase = window.supabaseClient;
  const { data, error } = await supabase
    .from('quiz_leaderboard')
    .select('user_id, username, avatar_url, score')
    .eq('quiz_id', currentQuizId)
    .order('score', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return;
  }

  renderLeaderboard(data);
}

function renderLeaderboard(players) {
  const listEl = elements.leaderboardList;
  if (!listEl) return;

  if (!players || players.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No participants yet. Be the first to join!</div>';
    return;
  }

  // Compute ranks and prize amounts
  const ranked = players.map((player, idx) => {
    const rank = idx + 1;
    let prize = 0;
    const dist = PRIZE_DISTRIBUTION.find(d => d.rank === rank);
    if (dist) prize = Math.floor(currentPrizePool * dist.percent);
    return { ...player, rank, prize };
  });

  listEl.innerHTML = ranked.map(player => `
    <div class="leaderboard-item ${player.isCurrentUser ? 'current-user' : ''}">
      <div class="rank rank-${player.rank}">
        ${player.rank === 1 ? '<iconify-icon icon="solar:medal-star-bold"></iconify-icon>' : 
          player.rank === 2 ? '<iconify-icon icon="solar:medal-ribbon-bold"></iconify-icon>' :
          player.rank === 3 ? '<iconify-icon icon="solar:medal-ribbon-bold"></iconify-icon>' : player.rank}
      </div>
      <div class="avatar">
        <img src="${player.avatar_url || '/assets/images/default-avatar.png'}" alt="${player.username}">
      </div>
      <div class="player-info">
        <div class="player-name">${player.username}</div>
      </div>
      <div class="score-prize">
        <span class="score">${player.score} pts</span>
        ${player.prize > 0 ? `<span class="prize">${formatCurrency(player.prize)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function subscribeToLeaderboard() {
  if (leaderboardSubscription) {
    leaderboardSubscription.unsubscribe();
  }
  if (!currentQuizId) return;
  const supabase = window.supabaseClient;
  leaderboardSubscription = supabase
    .channel(`leaderboard-${currentQuizId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'quiz_leaderboard',
        filter: `quiz_id=eq.${currentQuizId}`,
      },
      (payload) => {
        // Re-fetch leaderboard on any change
        fetchLeaderboard();
      }
    )
    .subscribe();
}

function subscribeToQuiz() {
  if (quizSubscription) {
    quizSubscription.unsubscribe();
  }
  if (!currentQuizId) return;
  const supabase = window.supabaseClient;
  quizSubscription = supabase
    .channel(`quiz-${currentQuizId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'quizzes',
        filter: `id=eq.${currentQuizId}`,
      },
      (payload) => {
        // Update prize pool and timer
        if (payload.new.prize_pool !== undefined) {
          currentPrizePool = payload.new.prize_pool;
          elements.prizePool.textContent = formatCurrency(currentPrizePool);
          // Re‑render leaderboard to reflect new prize amounts
          fetchLeaderboard();
        }
        if (payload.new.next_question_at) {
          currentEndTime = payload.new.next_question_at;
          startTimer(currentEndTime);
        }
      }
    )
    .subscribe();
}

async function switchType(type) {
  currentType = type;
  elements.typeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  // Reset UI
  elements.leaderboardList.innerHTML = '<div class="loading-spinner">Loading...</div>';
  await fetchCurrentQuiz();
  if (currentQuizId) {
    await fetchLeaderboard();
    subscribeToLeaderboard();
    subscribeToQuiz();
  } else {
    elements.leaderboardList.innerHTML = '<div class="empty-state">No active quiz available</div>';
  }
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

  // Set up type switcher
  elements.typeBtns.forEach(btn => {
    btn.addEventListener('click', () => switchType(btn.dataset.type));
  });

  // Load initial data
  await switchType('hourly');
})();
