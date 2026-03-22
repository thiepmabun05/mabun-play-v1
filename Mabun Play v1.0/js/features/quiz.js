// js/features/quiz.js
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
let currentQuestion = null;
let timeLeft = 0;
let totalTimeAllowed = 0;
let timerInterval = null;
let answerSubmitted = false;
let loading = false;
let nextQuestionTimer = null;

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  quizId = urlParams.get('id');
  sessionId = urlParams.get('session');
  console.log('Quiz ID:', quizId, 'Session ID:', sessionId);
}

function setLoading(isLoading) {
  loading = isLoading;
  elements.optionBtns.forEach(btn => (btn.disabled = isLoading));
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function clearNextTimer() {
  if (nextQuestionTimer) {
    clearTimeout(nextQuestionTimer);
    nextQuestionTimer = null;
  }
}

function updateTimerDisplay() {
  if (!elements.timerText) return;
  elements.timerText.textContent = timeLeft;

  if (elements.timerProgress && totalTimeAllowed > 0) {
    const circumference = 2 * Math.PI * 18; // r=18
    const offset = circumference * (1 - timeLeft / totalTimeAllowed);
    elements.timerProgress.style.strokeDashoffset = offset;

    if (timeLeft <= 3) {
      elements.timerProgress.style.stroke = 'var(--error)';
    } else if (timeLeft <= 5) {
      elements.timerProgress.style.stroke = 'var(--warning)';
    } else {
      elements.timerProgress.style.stroke = 'var(--success)';
    }
  }
}

function startTimer(seconds) {
  stopTimer();
  clearNextTimer();
  totalTimeAllowed = seconds;
  timeLeft = seconds;
  answerSubmitted = false;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timeLeft -= 1;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      stopTimer();
      if (!answerSubmitted && !loading) {
        submitAnswer(null);
      }
    }
  }, 1000);
}

async function loadNextQuestion() {
  stopTimer();
  setLoading(true);
  answerSubmitted = false;

  try {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Supabase client not available');

    const { data: next, error } = await supabase.rpc('get_next_question', { session_id: sessionId });
    if (error) throw error;

    if (next.finished) {
      window.location.href = `results.html?id=${quizId}&session=${sessionId}`;
      return;
    }

    currentQuestion = next.question;
    if (elements.scoreValue) elements.scoreValue.textContent = next.session.score;
    if (elements.streakCount) elements.streakCount.textContent = next.session.streak;
    if (elements.questionCounter) {
      elements.questionCounter.textContent = `${next.session.currentQuestionIndex + 1}/${next.session.totalQuestions}`;
    }

    renderQuestion(currentQuestion);
  } catch (err) {
    console.error('Failed to load next question:', err);
    await showModal({
      title: 'Error',
      message: err.message || 'Could not load next question. Please refresh.',
      confirmText: 'OK',
    });
    window.location.href = 'dashboard.html';
  } finally {
    setLoading(false);
  }
}

function renderQuestion(question) {
  if (!question) return;

  if (elements.quizTitle) elements.quizTitle.textContent = 'Quiz';
  if (elements.difficultyStars) {
    const difficulty = question.difficulty || 'medium';
    let starCount = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    elements.difficultyStars.innerHTML = '';
    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('iconify-icon');
      star.setAttribute('icon', 'solar:star-bold');
      star.classList.add('star');
      elements.difficultyStars.appendChild(star);
    }
  }
  if (elements.questionText) elements.questionText.textContent = question.text;
  if (elements.optionsGrid && question.options) {
    const letters = ['A', 'B', 'C', 'D'];
    elements.optionBtns.forEach((btn, index) => {
      const option = question.options[letters[index]];
      if (option) {
        btn.style.display = 'flex';
        btn.querySelector('.option-letter').textContent = letters[index];
        btn.querySelector('.option-text').textContent = option;
        btn.dataset.optionId = letters[index];
        btn.disabled = false;
        btn.classList.remove('correct', 'incorrect', 'selected');
      } else {
        btn.style.display = 'none';
      }
    });
  }
  const timeAllowed = question.timeAllowed || 10;
  startTimer(timeAllowed);
}

async function submitAnswer(optionId) {
  if (answerSubmitted || loading) return;
  answerSubmitted = true;
  stopTimer();

  elements.optionBtns.forEach(btn => (btn.disabled = true));

  const feedbackDelay = 300; // milliseconds
  const waitTime = Math.max(0, timeLeft * 1000) + feedbackDelay;

  try {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Supabase client not available');

    const { data: result, error } = await supabase.rpc('submit_answer', {
      session_id: sessionId,
      question_id: currentQuestion.id,
      option_id: optionId,
      time_remaining: timeLeft,
    });
    if (error) throw error;

    if (elements.scoreValue) elements.scoreValue.textContent = result.newScore;
    if (elements.streakCount) elements.streakCount.textContent = result.newStreak;

    if (result.correctOptionId) {
      elements.optionBtns.forEach(btn => {
        if (btn.dataset.optionId === result.correctOptionId) {
          btn.classList.add('correct');
        }
        if (optionId && btn.dataset.optionId === optionId && !result.correct) {
          btn.classList.add('incorrect');
        }
      });
    }

    clearNextTimer();
    nextQuestionTimer = setTimeout(() => {
      loadNextQuestion();
    }, waitTime);
  } catch (err) {
    console.error('Answer submission failed:', err);
    await showModal({
      title: 'Submission Error',
      message: err.message || 'Your answer could not be recorded. Please refresh.',
      confirmText: 'OK',
    });
    setLoading(false);
    nextQuestionTimer = setTimeout(() => loadNextQuestion(), 1000);
  }
}

function onOptionClick(e) {
  const btn = e.currentTarget;
  if (btn.disabled || answerSubmitted || loading) return;
  const optionId = btn.dataset.optionId;
  if (!optionId) return;

  elements.optionBtns.forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  submitAnswer(optionId);
}

function openQuitModal() {
  if (elements.quitModal) elements.quitModal.classList.add('active');
}
function closeQuitModal() {
  if (elements.quitModal) elements.quitModal.classList.remove('active');
}

async function initQuiz() {
  getUrlParams();
  if (!quizId || !sessionId) {
    await showModal({ title: 'No Quiz', message: 'Invalid quiz session. Redirecting to dashboard.', confirmText: 'OK' });
    window.location.href = 'dashboard.html';
    return;
  }

  setLoading(true);
  try {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Supabase client not available');

    const { data: first, error } = await supabase.rpc('get_next_question', { session_id: sessionId });
    if (error) throw error;

    if (first.finished) {
      window.location.href = `results.html?id=${quizId}&session=${sessionId}`;
      return;
    }

    currentQuestion = first.question;
    if (elements.scoreValue) elements.scoreValue.textContent = first.session.score;
    if (elements.streakCount) elements.streakCount.textContent = first.session.streak;
    if (elements.questionCounter) {
      elements.questionCounter.textContent = `${first.session.currentQuestionIndex + 1}/${first.session.totalQuestions}`;
    }

    renderQuestion(currentQuestion);
  } catch (err) {
    console.error('Failed to start quiz:', err);
    await showModal({
      title: 'Error',
      message: err.message || 'Could not start the quiz. Please try again.',
      confirmText: 'OK',
    });
    window.location.href = 'dashboard.html';
  } finally {
    setLoading(false);
  }
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

document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
  initQuiz();
});

window.addEventListener('beforeunload', () => {
  stopTimer();
  clearNextTimer();
});
