```javascript
// js/features/quiz.js (FIXED VERSION)
import { showModal } from '../utils/modal.js';

const elements = {
  quitBtn: document.getElementById('quitQuiz'),
  quizTitle: document.getElementById('quizTitle'),
  questionCounter: document.getElementById('questionCounter'),
  timerText: document.getElementById('timerText'),
  timerProgress: document.querySelector('.timer-progress'),
  difficultyStars: document.getElementById('difficultyStars'),
  questionText: document.getElementById('questionText'),
  optionsGrid: document.getElementById('optionsGrid'),
  optionBtns: document.querySelectorAll('.option-btn'),
  streakCount: document.getElementById('streakCount'),
  scoreValue: document.getElementById('scoreValue'),
  quitModal: document.getElementById('quitModal'),
  cancelQuit: document.getElementById('cancelQuit'),
};

let quizId = null;
let sessionId = null;

let quizStartTime = null;
let quizEndTime = null;
let questionTimeSec = 10;
let totalQuestions = 0;

let currentIndex = -1;
let answerSubmitted = false;
let timerInterval = null;
let questions = [];

// ✅ NEW: Prevent instant auto-submit bugs
let questionLoadTime = 0;
const MIN_GRACE_MS = 800; // 0.8s protection window

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  quizId = urlParams.get('id');
  sessionId = urlParams.get('session');
  console.log('Quiz ID:', quizId, 'Session ID:', sessionId);
}

function setLoading(isLoading) {
  elements.optionBtns.forEach(btn => (btn.disabled = isLoading));
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay(remainingSecs) {
  if (!elements.timerText) return;
  const displaySecs = Math.floor(remainingSecs);
  elements.timerText.textContent = displaySecs;

  if (elements.timerProgress && questionTimeSec > 0) {
    const circumference = 2 * Math.PI * 18;
    const offset = circumference * (1 - remainingSecs / questionTimeSec);
    elements.timerProgress.style.strokeDashoffset = offset;

    if (remainingSecs <= 3) {
      elements.timerProgress.style.stroke = 'var(--destructive)';
    } else if (remainingSecs <= 5) {
      elements.timerProgress.style.stroke = 'var(--warning)';
    } else {
      elements.timerProgress.style.stroke = 'var(--success)';
    }
  }
}

function renderQuestion(index) {
  const q = questions[index];
  if (!q) return;

  if (elements.difficultyStars) {
    const stars = q.difficulty === 'easy' ? 1 : q.difficulty === 'medium' ? 2 : 3;
    elements.difficultyStars.innerHTML = '';
    for (let i = 0; i < stars; i++) {
      const star = document.createElement('iconify-icon');
      star.setAttribute('icon', 'solar:star-bold');
      star.classList.add('star');
      elements.difficultyStars.appendChild(star);
    }
  }

  if (elements.questionText) elements.questionText.textContent = q.text;

  if (elements.optionsGrid && q.options) {
    const letters = ['A', 'B', 'C', 'D'];
    elements.optionBtns.forEach((btn, i) => {
      const option = q.options[letters[i]];
      if (option) {
        btn.style.display = 'flex';
        btn.querySelector('.option-letter').textContent = letters[i];
        btn.querySelector('.option-text').textContent = option;
        btn.dataset.optionId = letters[i];
        btn.disabled = false;
        btn.classList.remove('correct', 'incorrect', 'selected');
      } else {
        btn.style.display = 'none';
      }
    });
  }

  if (elements.questionCounter) {
    elements.questionCounter.textContent = `${index + 1}/${totalQuestions}`;
  }
}

function checkQuizEnded() {
  const now = Date.now();
  if (now >= quizEndTime) {
    stopTimer();
    window.location.href = `results.html?id=${quizId}&session=${sessionId}`;
    return true;
  }
  return false;
}

function getCurrentIndex() {
  const now = Date.now();
  const elapsedSec = (now - quizStartTime) / 1000;
  const idx = Math.floor(elapsedSec / questionTimeSec);
  return Math.min(idx, totalQuestions - 1);
}

// ✅ FIXED: Prevent negative / zero instant timing bugs
function getRemainingSecs() {
  const now = Date.now();
  const elapsedSec = (now - quizStartTime) / 1000;
  const questionStartOffset = currentIndex * questionTimeSec;
  const questionElapsed = elapsedSec - questionStartOffset;

  return Math.max(0.5, questionTimeSec - questionElapsed);
}

async function submitAnswer(optionId) {
  if (answerSubmitted) return;
  answerSubmitted = true;

  const remainingSecs = getRemainingSecs();
  const integerRemaining = Math.floor(remainingSecs);

  console.log("RPC payload:", {
    sessionId,
    currentIndex,
    optionId,
    integerRemaining
  });

  const { data, error } = await window.supabaseClient.rpc('submit_answer_sync', {
    p_session_id: sessionId,
    p_question_index: currentIndex,
    p_option_id: optionId,
    p_time_remaining: integerRemaining,
  });

  if (error) {
    console.error('Submit error:', error);
    await showModal({ title: 'Error', message: 'Could not submit answer. Please refresh.', confirmText: 'OK' });
    return;
  }

  if (data.finished) {
    window.location.href = `results.html?id=${quizId}&session=${sessionId}`;
    return;
  }

  if (elements.scoreValue) elements.scoreValue.textContent = data.newScore;
  if (elements.streakCount) elements.streakCount.textContent = data.newStreak;

  if (data.correctOptionId) {
    elements.optionBtns.forEach(btn => {
      if (btn.dataset.optionId === data.correctOptionId) {
        btn.classList.add('correct');
      }
      if (optionId && btn.dataset.optionId === optionId && !data.correct) {
        btn.classList.add('incorrect');
      }
    });
  }

  elements.optionBtns.forEach(btn => (btn.disabled = true));
}

function onOptionClick(e) {
  const btn = e.currentTarget;
  if (btn.disabled || answerSubmitted) return;

  const optionId = btn.dataset.optionId;
  if (!optionId) return;

  elements.optionBtns.forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  submitAnswer(optionId);
}

async function loadQuiz() {
  const supabase = window.supabaseClient;
  if (!supabase) {
    showModal({ title: 'Error', message: 'Supabase client not loaded.', confirmText: 'OK' });
    return;
  }

  const { data: quizMeta, error: metaError } = await supabase
    .from('quizzes')
    .select('starts_at, ends_at, question_time, total_questions, title')
    .eq('id', quizId)
    .single();

  if (metaError || !quizMeta) {
    window.location.href = 'dashboard.html';
    return;
  }

  quizStartTime = new Date(quizMeta.starts_at).getTime();
  quizEndTime = new Date(quizMeta.ends_at).getTime();
  questionTimeSec = quizMeta.question_time;
  totalQuestions = quizMeta.total_questions;

  if (elements.quizTitle) elements.quizTitle.textContent = quizMeta.title;

  const { data: sessionData } = await supabase
    .from('quiz_sessions')
    .select('score, streak')
    .eq('id', sessionId)
    .single();

  if (sessionData) {
    if (elements.scoreValue) elements.scoreValue.textContent = sessionData.score;
    if (elements.streakCount) elements.streakCount.textContent = sessionData.streak;
  }

  const { data: qs, error: qError } = await supabase.rpc('get_quiz_questions', { p_quiz_id: quizId });

  if (qError || !qs || qs.length === 0) {
    showModal({ title: 'Error', message: 'Could not load quiz questions.', confirmText: 'OK' });
    window.location.href = 'dashboard.html';
    return;
  }

  questions = qs;
  startLoop();
  attachEvents();
}

function startLoop() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (checkQuizEnded()) return;

    const now = Date.now();

    if (now < quizStartTime) {
      const diffSec = Math.max(0, (quizStartTime - now) / 1000);
      const mins = Math.floor(diffSec / 60);
      const secs = Math.floor(diffSec % 60);

      elements.timerText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      elements.questionText.textContent = 'Quiz starts soon...';
      elements.optionsGrid.style.display = 'none';
      return;
    } else {
      elements.optionsGrid.style.display = 'flex';
    }

    const newIndex = getCurrentIndex();
    const remainingSecs = getRemainingSecs();

    updateTimerDisplay(remainingSecs);

    if (newIndex !== currentIndex) {

      // ✅ FIX: Skip already expired question
      if (remainingSecs < 1) {
        currentIndex = newIndex;
        return;
      }

      currentIndex = newIndex;
      answerSubmitted = false;
      questionLoadTime = Date.now();

      elements.optionBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('correct', 'incorrect', 'selected');
      });

      renderQuestion(currentIndex);
    }

    // ✅ FIX: Grace period before auto-submit
    const timeSinceLoad = Date.now() - questionLoadTime;

    if (
      remainingSecs <= 0 &&
      !answerSubmitted &&
      currentIndex >= 0 &&
      timeSinceLoad > MIN_GRACE_MS
    ) {
      submitAnswer(null);
    }

  }, 200);
}

function attachEvents() {
  elements.optionBtns.forEach(btn => btn.addEventListener('click', onOptionClick));

  if (elements.quitBtn) elements.quitBtn.addEventListener('click', openQuitModal);
  if (elements.cancelQuit) elements.cancelQuit.addEventListener('click', closeQuitModal);

  if (elements.quitModal) {
    elements.quitModal.addEventListener('click', (e) => {
      if (e.target === elements.quitModal) closeQuitModal();
    });
  }
}

function openQuitModal() {
  if (elements.quitModal) elements.quitModal.classList.add('active');
}

function closeQuitModal() {
  if (elements.quitModal) elements.quitModal.classList.remove('active');
}

function init() {
  getUrlParams();

  if (!quizId || !sessionId) {
    showModal({ title: 'No Quiz', message: 'Invalid quiz session.', confirmText: 'OK' })
      .then(() => window.location.href = 'dashboard.html');
    return;
  }

  loadQuiz();
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeunload', () => {
  if (timerInterval) clearInterval(timerInterval);
});
```
