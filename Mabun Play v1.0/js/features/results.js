// js/features/results.js
import { showModal } from '../utils/modal.js';
import { formatCurrency } from '../utils/formatters.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const quizId = urlParams.get('id');
  const sessionId = urlParams.get('session');
  if (!quizId || !sessionId) {
    window.location.href = 'dashboard.html';
    return;
  }

  const elements = {
    quizTitle: document.getElementById('resultQuizTitle'),
    badge: document.getElementById('resultBadge'),
    scorePercentage: document.getElementById('scorePercentage'),
    scorePoints: document.getElementById('scorePoints'),
    correctCount: document.getElementById('correctCount'),
    incorrectCount: document.getElementById('incorrectCount'),
    earnings: document.getElementById('earnings'),
    topPlayersList: document.getElementById('topPlayersList')
  };

  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error('Supabase client not available');
    return;
  }

  try {
    const { data: results, error } = await supabase
      .rpc('get_quiz_results', { session_id: sessionId });
    if (error) throw error;
    renderResults(results);
  } catch (error) {
    await showModal({ title: 'Error', message: error.message, confirmText: 'OK' });
  }

  function renderResults(data) {
    elements.quizTitle.textContent = data.quizTitle;
    elements.badge.textContent = data.rank <= 3 ? `#${data.rank} Winner!` : `#${data.rank}`;
    const percent = Math.round((data.correct / data.total) * 100) || 0;
    elements.scorePercentage.textContent = percent + '%';
    elements.scorePoints.textContent = data.score + ' pts';
    elements.correctCount.textContent = data.correct;
    elements.incorrectCount.textContent = data.incorrect;
    elements.earnings.textContent = formatCurrency(data.earnings || 0);

    const circle = document.querySelector('.score-progress');
    if (circle) {
      const circumference = 2 * Math.PI * 54;
      const offset = circumference * (1 - percent / 100);
      circle.style.strokeDasharray = `${circumference}`;
      circle.style.strokeDashoffset = offset;
    }

    if (elements.topPlayersList && data.topPlayers) {
      elements.topPlayersList.innerHTML = data.topPlayers.map((p, idx) => `
        <div class="top-player">
          <span class="top-rank">${idx + 1}</span>
          <span class="top-name">${p.name}</span>
          <span class="top-score">${p.score} pts</span>
          ${p.prize ? `<span class="top-prize">${formatCurrency(p.prize)}</span>` : ''}
        </div>
      `).join('');
    }
  }
});
