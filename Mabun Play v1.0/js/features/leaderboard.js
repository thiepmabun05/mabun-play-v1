import { supabase } from '../core/supabase.js';
import { formatCurrency } from '../utils/formatters.js';

let currentType = 'hourly';
let quizData = {};
let participants = [];
let displayedCount = 0;
let pageSize = 100;
let isLoading = false;
let hasMore = true;
let timerInterval = null;

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

async function fetchQuizData(type) {
  try {
    const { data, error } = await supabase
      .from('leaderboard_meta')
      .select('*')
      .eq('type', type)
      .single();
    if (error) throw error;
    quizData = data;
    elements.quizName.textContent = data.name;
    elements.qualifierText.textContent = data.qualifier;
    elements.prizePool.textContent = formatCurrency(data.prizePool);
    startTimer(data.endTime);
  } catch (err) {
    console.error(err);
  }
}

async function fetchParticipants(type, page = 1) {
  try {
    isLoading = true;
    elements.loadingSpinner.style.display = 'flex';
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('leaderboard_entries')
      .select('*', { count: 'exact' })
      .eq('type', type)
      .order('score', { ascending: false })
      .range(from, to);
    if (error) throw error;

    const newParticipants = data;
    participants = page === 1 ? newParticipants : [...participants, ...newParticipants];
    displayedCount = participants.length;
    hasMore = displayedCount < count;
    renderLeaderboard(participants);
    elements.loadMoreContainer.style.display = hasMore ? 'flex' : 'none';
  } catch (err) {
    console.error(err);
  } finally {
    isLoading = false;
    elements.loadingSpinner.style.display = 'none';
  }
}

function renderLeaderboard(participantsToRender) {
  const listEl = elements.leaderboardList;
  listEl.innerHTML = '';
  participantsToRender.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = `leaderboard-item ${item.is_current_user ? 'current-user' : ''}`;

    const rankDiv = document.createElement('div');
    rankDiv.className = `rank rank-${item.rank}`;
    if (item.rank === 1) {
      rankDiv.innerHTML = `<iconify-icon icon="solar:medal-star-bold" class="rank-icon"></iconify-icon>`;
    } else if (item.rank === 2 || item.rank === 3) {
      rankDiv.innerHTML = `<iconify-icon icon="solar:medal-ribbon-bold" class="rank-icon"></iconify-icon>`;
    } else {
      rankDiv.textContent = item.rank;
    }

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.textContent = item.initials;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'player-info';
    infoDiv.innerHTML = `
      <div class="player-name">${item.name}</div>
      <div class="player-streak">${item.streak || ''}</div>
    `;

    const scoreTrendDiv = document.createElement('div');
    scoreTrendDiv.className = 'score-trend-prize';
    const prize = item.prize ? formatCurrency(item.prize) : '';
    const trendIcon = item.trend_dir === 'up' ? 'arrow-up-bold' : 'arrow-down-bold';
    scoreTrendDiv.innerHTML = `
      <span class="score">${item.score} pts</span>
      ${item.trend ? `
        <span class="trend trend-${item.trend_dir}">
          <iconify-icon icon="solar:${trendIcon}"></iconify-icon>
          ${item.trend}
        </span>
      ` : ''}
      ${prize ? `<span class="prize-amount">${prize}</span>` : ''}
    `;

    itemDiv.appendChild(rankDiv);
    itemDiv.appendChild(avatarDiv);
    itemDiv.appendChild(infoDiv);
    itemDiv.appendChild(scoreTrendDiv);

    if (item.is_current_user) {
      const badge = document.createElement('div');
      badge.className = 'you-badge';
      badge.textContent = 'You';
      itemDiv.appendChild(badge);
    }

    listEl.appendChild(itemDiv);
  });
}

function updateParticipant(updated) {
  const index = participants.findIndex(p => p.id === updated.id);
  if (index === -1) {
    participants.push(updated);
  } else {
    participants[index] = { ...participants[index], ...updated };
  }
  participants.sort((a, b) => b.score - a.score);
  participants.forEach((p, idx) => {
    const oldRank = p.rank;
    p.rank = idx + 1;
    if (oldRank && oldRank !== p.rank) {
      p.trend = Math.abs(oldRank - p.rank);
      p.trend_dir = oldRank > p.rank ? 'up' : 'down';
    } else {
      p.trend = 0;
    }
  });
  renderLeaderboard(participants.slice(0, displayedCount));
}

function subscribeToLeaderboard() {
  const subscription = supabase
    .channel('leaderboard-updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leaderboard_entries', filter: `type=eq.${currentType}` },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          updateParticipant(payload.new);
        }
      }
    )
    .subscribe();
  return subscription;
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

async function loadMore() {
  if (isLoading || !hasMore) return;
  const nextPage = Math.floor(displayedCount / pageSize) + 1;
  await fetchParticipants(currentType, nextPage);
}

async function switchType(type) {
  currentType = type;
  elements.typeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  participants = [];
  displayedCount = 0;
  hasMore = true;
  renderLeaderboard([]);
  await fetchQuizData(type);
  await fetchParticipants(type, 1);
  if (window.leaderboardSubscription) window.leaderboardSubscription.unsubscribe();
  window.leaderboardSubscription = subscribeToLeaderboard();
}

elements.typeBtns.forEach(btn => {
  btn.addEventListener('click', () => switchType(btn.dataset.type));
});

elements.loadMoreBtn.addEventListener('click', loadMore);

(async function init() {
  await fetchQuizData(currentType);
  await fetchParticipants(currentType, 1);
  window.leaderboardSubscription = subscribeToLeaderboard();
})();

window.addEventListener('beforeunload', () => {
  if (timerInterval) clearInterval(timerInterval);
  if (window.leaderboardSubscription) window.leaderboardSubscription.unsubscribe();
});