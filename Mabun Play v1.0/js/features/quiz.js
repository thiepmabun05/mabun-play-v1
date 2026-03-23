// js/features/quiz.js (FINAL WITH LOGGING)
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

let questionLoadTime = 0;
const MIN_GRACE_MS = 800;

let pendingAnswers = [];
let realtimeChannel = null;

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  quizId = urlParams.get('id');
  sessionId = urlParams.get('session');
  console.log('[DEBUG] quizId:', quizId, 'sessionId:', sessionId);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay(remainingSecs) {
  if (!elements.timerText) return;
  elements.timerText.textContent = Math.floor(remainingSecs);
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
  if (!q) {
    console.warn('[DEBUG] renderQuestion: no question at index', index);
    return;
  }
  console.log('[DEBUG] renderQuestion index', index, 'text:', q.text);

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

  elements.questionText.textContent = q.text;

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

  elements.questionCounter.textContent = `${index + 1}/${totalQuestions}`;
}

function getCurrentIndex() {
  const now = Date.now();
  const elapsed = (now - quizStartTime) / 1000;
  const idx = Math.floor(elapsed / questionTimeSec);
  return Math.min(idx, totalQuestions - 1);
}

function getRemainingSecs() {
  const now = Date.now();
  const elapsed = (now - quizStartTime) / 1000;
  const questionStart = currentIndex * questionTimeSec;
  const questionElapsed = elapsed - questionStart;
  return Math.max(0.5, questionTimeSec - questionElapsed);
}

function handleAnswerResponse(data, optionId) {
  if (data.error) {
    console.warn("Server rejected:", data);
    if (data.correctIndex !== undefined) {
      currentIndex = data.correctIndex;
      renderQuestion(currentIndex);
    }
    return;
  }
  if (data.finished) {
    window.location.href = `results.html?id=${quizId}&session=${sessionId}`;
    return;
  }
  elements.scoreValue.textContent = data.newScore;
  elements.streakCount.textContent = data.newStreak;
  elements.optionBtns.forEach(btn => {
    if (btn.dataset.optionId === data.correctOptionId) {
      btn.classList.add('correct');
    }
    if (optionId && btn.dataset.optionId === optionId && !data.correct) {
      btn.classList.add('incorrect');
    }
  });
  elements.optionBtns.forEach(btn => (btn.disabled = true));
}

async function submitAnswer(optionId) {
  if (answerSubmitted) return;
  answerSubmitted = true;
  const payload = {
    p_session_id: sessionId,
    p_question_index: currentIndex,
    p_option_id: optionId,
    p_time_remaining: Math.floor(getRemainingSecs())
  };
  try {
    const { data, error } = await window.supabaseClient.rpc('submit_answer_sync', payload);
    if (error) throw error;
    handleAnswerResponse(data, optionId);
  } catch (err) {
    console.error('Submit error:', err);
    await showModal({ title: 'Error', message: 'Could not submit answer. Please refresh.', confirmText: 'OK' });
    answerSubmitted = false; // allow retry
  }
}

setInterval(async () => {
  if (!pendingAnswers.length) return;
  const queue = [...pendingAnswers];
  pendingAnswers = [];
  for (const payload of queue) {
    try {
      const { data, error } = await window.supabaseClient.rpc('submit_answer_sync', payload);
      if (!error) handleAnswerResponse(data, payload.p_option_id);
    } catch {
      pendingAnswers.push(payload);
    }
  }
}, 3000);

function onOptionClick(e) {
  const btn = e.currentTarget;
  if (btn.disabled || answerSubmitted) return;
  const optionId = btn.dataset.optionId;
  elements.optionBtns.forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  submitAnswer(optionId);
}

function startLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const now = Date.now();

    if (now >= quizEndTime) {
      stopTimer();
      window.location.href = `results.html?id=${quizId}&session=${sessionId}`;
      return;
    }

    if (now < quizStartTime) {
      const diff = (quizStartTime - now) / 1000;
      elements.timerText.textContent = `${Math.floor(diff / 60)}:${Math.floor(diff % 60).toString().padStart(2, '0')}`;
      elements.questionText.textContent = 'Quiz starts soon...';
      elements.optionsGrid.style.display = 'none';
      return;
    }

    elements.optionsGrid.style.display = 'flex';

    const newIndex = getCurrentIndex();
    const remainingSecs = getRemainingSecs();

    console.log(`[DEBUG] Loop: now=${now}, newIndex=${newIndex}, currentIndex=${currentIndex}, remainingSecs=${remainingSecs.toFixed(2)}, answerSubmitted=${answerSubmitted}`);

    updateTimerDisplay(remainingSecs);

    if (newIndex !== currentIndex) {
      console.log(`[DEBUG] Index changed from ${currentIndex} to ${newIndex}`);
      currentIndex = newIndex;
      answerSubmitted = false;
      questionLoadTime = Date.now();
      elements.optionBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('correct', 'incorrect', 'selected');
      });
      renderQuestion(currentIndex);
    }

    if (remainingSecs <= 0 && !answerSubmitted && (Date.now() - questionLoadTime) > MIN_GRACE_MS) {
      console.log('[DEBUG] Timer expired, auto‑submitting');
      submitAnswer(null);
    }
  }, 200);
}

function setupRealtime() {
  realtimeChannel = window.supabaseClient
    .channel('quiz-session')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'quiz_sessions',
      filter: `id=eq.${sessionId}`
    }, payload => {
      const data = payload.new;
      if (elements.scoreValue) elements.scoreValue.textContent = data.score;
      if (elements.streakCount) elements.streakCount.textContent = data.streak;
    })
    .subscribe();
}

function attachEvents() {
  elements.optionBtns.forEach(btn => btn.addEventListener('click', onOptionClick));
  elements.quitBtn?.addEventListener('click', () => elements.quitModal.classList.add('active'));
  elements.cancelQuit?.addEventListener('click', () => elements.quitModal.classList.remove('active'));
  elements.quitModal?.addEventListener('click', e => {
    if (e.target === elements.quitModal) elements.quitModal.classList.remove('active');
  });
}

async function loadQuiz() {
  const supabase = window.supabaseClient;
  if (!supabase) {
    showModal({ title: 'Error', message: 'Supabase client not loaded.', confirmText: 'OK' });
    return;
  }

  console.log('[DEBUG] Loading quiz', quizId, sessionId);

  const { data: quizMeta, error: metaError } = await supabase
    .from('quizzes')
    .select('starts_at, ends_at, question_time, total_questions, title')
    .eq('id', quizId)
    .single();

  if (metaError || !quizMeta) {
    console.error('[DEBUG] Quiz metadata error:', metaError);
    window.location.href = 'dashboard.html';
    return;
  }

  console.log('[DEBUG] Quiz metadata:', quizMeta);

  quizStartTime = new Date(quizMeta.starts_at).getTime();
  quizEndTime = new Date(quizMeta.ends_at).getTime();
  questionTimeSec = quizMeta.question_time;
  totalQuestions = quizMeta.total_questions;
  elements.quizTitle.textContent = quizMeta.title;

  console.log(`[DEBUG] quizStartTime: ${new Date(quizStartTime).toISOString()}, now: ${new Date().toISOString()}`);
  console.log(`[DEBUG] questionTimeSec=${questionTimeSec}, totalQuestions=${totalQuestions}`);

  const { data: sessionData } = await supabase
    .from('quiz_sessions')
    .select('score, streak')
    .eq('id', sessionId)
    .single();

  if (sessionData) {
    elements.scoreValue.textContent = sessionData.score;
    elements.streakCount.textContent = sessionData.streak;
    console.log('[DEBUG] Session score:', sessionData.score, 'streak:', sessionData.streak);
  }

  // Fetch questions
  const { data: qs, error: qError } = await supabase.rpc('get_quiz_questions', { p_quiz_id: quizId });
  if (qError) {
    console.error('[DEBUG] RPC error:', qError);
  }
  console.log('[DEBUG] RPC returned questions:', qs?.length, qs?.[0]);

  if (!qs || qs.length === 0) {
    console.error('[DEBUG] No questions loaded!');
    await showModal({ title: 'Error', message: 'No questions found for this quiz.', confirmText: 'OK' });
    window.location.href = 'dashboard.html';
    return;
  }

  questions = qs;
  console.log('[DEBUG] Questions array length:', questions.length);

  // Force render if quiz is active
  if (Date.now() >= quizStartTime) {
    currentIndex = getCurrentIndex();
    renderQuestion(currentIndex);
  }

  setupRealtime();
  startLoop();
  attachEvents();
}

function init() {
  getUrlParams();
  if (!quizId || !sessionId) {
    showModal({
      title: 'Error',
      message: 'Invalid quiz session',
      confirmText: 'OK'
    }).then(() => window.location.href = 'dashboard.html');
    return;
  }
  loadQuiz();
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('beforeunload', () => {
  if (timerInterval) clearInterval(timerInterval);
  if (realtimeChannel) realtimeChannel.unsubscribe();
});
