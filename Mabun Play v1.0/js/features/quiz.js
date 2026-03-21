// js/features/quiz.js
import { showModal } from '../utils/modal.js';

// ---------- DOM elements ----------
const elements = {
  quitBtn: document.getElementById('quitQuiz'),
  quizTitle: document.getElementById('quizTitle'),
  questionCounter: document.getElementById('questionCounter'),
  timerCircle: document.getElementById('timerCircle'),
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

// ---------- State ----------
let quizId = null;
let session = null;
let currentQuestion = null;
let timeLeft = 0;
let totalTimeAllowed = 0; // store for progress calculation
let timerInterval = null;
let answerSubmitted = false;
let loading = false;
let nextQuestionTimer = null;

// ---------- Helper: parse URL ----------
function getQuizId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// ---------- Helper: set loading state ----------
function setLoading(isLoading) {
  loading = isLoading;
  elements.optionBtns.forEach(btn => {
    btn.disabled = isLoading;
  });
}

// ---------- Helper: stop the countdown timer ----------
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ---------- Helper: clear any pending next question timeout ----------
function clearNextTimer() {
  if (nextQuestionTimer) {
    clearTimeout(nextQuestionTimer);
    nextQuestionTimer = null;
  }
}

// ---------- Helper: update timer display (text and circle) ----------
function updateTimerDisplay() {
  if (!elements.timerText) return;
  elements.timerText.textContent = timeLeft;

  if (elements.timerProgress && totalTimeAllowed > 0) {
    const circumference = 2 * Math.PI * 18; // r=18
    const offset = circumference * (1 - timeLeft / totalTimeAllowed);
    elements.timerProgress.style.strokeDashoffset = offset;

    // Color changes
    if (timeLeft <= 3) {
      elements.timerProgress.style.stroke = 'var(--error)';
    } else if (timeLeft <= 5) {
      elements.timerProgress.style.stroke = 'var(--warning)';
    } else {
      elements.timerProgress.style.stroke = 'var(--success)';
    }
  }
}

// ---------- Helper: start the countdown timer for the current question ----------
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
        // Time's up – submit null answer
        submitAnswer(null);
      }
    }
  }, 1000);
}

// ---------- Helper: render the current question on screen ----------
function renderQuestion(question) {
  if (!question) return;

  // Set quiz title (once)
  if (elements.quizTitle) {
    elements.quizTitle.textContent = session?.quizName || 'Quiz';
  }

  // Update question counter
  if (elements.questionCounter && session) {
    elements.questionCounter.textContent = `${session.currentQuestionIndex + 1}/${session.totalQuestions}`;
  }

  // Difficulty stars
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

  // Question text
  if (elements.questionText) {
    elements.questionText.textContent = question.text || '—';
  }

  // Options
  if (elements.optionsGrid && question.options) {
    const letters = ['A', 'B', 'C', 'D'];
    elements.optionBtns.forEach((btn, index) => {
      const option = question.options[index];
      if (option) {
        btn.style.display = 'flex';
        btn.querySelector('.option-letter').textContent = letters[index];
        btn.querySelector('.option-text').textContent = option.text || '';
        btn.dataset.optionId = option.id || letters[index];
        btn.disabled = false;
        btn.classList.remove('correct', 'incorrect', 'selected');
      } else {
        btn.style.display = 'none';
      }
    });
  }

  // Start the timer
  const timeAllowed = question.timeAllowed || 10;
  startTimer(timeAllowed);
}

// ---------- Helper: load the next question (or finish) ----------
async function loadNextQuestion() {
  stopTimer();
  setLoading(true);
  answerSubmitted = false;

  try {
    // Check if we are at the last question already (client-side check)
    if (session && session.currentQuestionIndex + 1 >= session.totalQuestions) {
      window.location.href = `results.html?id=${quizId}`;
      return;
    }

    const data = await apiClient(`/quiz/next?sessionId=${session.id}`, { method: 'POST' });

    if (data.finished) {
      window.location.href = `results.html?id=${quizId}`;
      return;
    }

    // Update session and question
    session = data.session;
    currentQuestion = data.question;

    // Update displayed score and streak
    if (elements.scoreValue) elements.scoreValue.textContent = session.score || 0;
    if (elements.streakCount) elements.streakCount.textContent = session.streak || 0;

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

// ---------- Helper: submit the answer to the server and wait ----------
async function submitAnswer(optionId) {
  if (answerSubmitted || loading) return;
  answerSubmitted = true;
  stopTimer(); // stop the countdown

  // Disable all options immediately
  elements.optionBtns.forEach(btn => { btn.disabled = true; });

  // Wait for the remaining time plus a small feedback delay
  const feedbackDelay = 300; // ms
  const remainingMs = (timeLeft > 0 ? timeLeft : 0) * 1000;
  const waitTime = remainingMs + feedbackDelay;

  try {
    const payload = {
      sessionId: session.id,
      questionId: currentQuestion.id,
      optionId: optionId,
      timeRemaining: timeLeft,
    };
    const result = await apiClient('/quiz/answer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // Update displayed score and streak
    if (elements.scoreValue) elements.scoreValue.textContent = result.newScore || session.score;
    if (elements.streakCount) elements.streakCount.textContent = result.newStreak || session.streak;

    // Highlight correct/incorrect options
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

    // Schedule next question after waiting full time
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
    // On error, try to recover after a short delay
    nextQuestionTimer = setTimeout(() => loadNextQuestion(), 1000);
  }
}

// ---------- Event handlers ----------
function onOptionClick(e) {
  const btn = e.currentTarget;
  if (btn.disabled || answerSubmitted || loading) return;
  const optionId = btn.dataset.optionId;
  if (!optionId) return;

  // Visual feedback: mark as selected
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

// ---------- Initialisation ----------
async function initQuiz() {
  quizId = getQuizId();
  if (!quizId) {
    await showModal({
      title: 'No Quiz',
      message: 'No quiz specified. Redirecting to dashboard.',
      confirmText: 'OK',
    });
    window.location.href = 'dashboard.html';
    return;
  }

  setLoading(true);
  try {
    const data = await apiClient(`/quiz/start?id=${quizId}`, { method: 'POST' });
    session = data.session;
    currentQuestion = data.question;

    if (elements.scoreValue) elements.scoreValue.textContent = session.score || 0;
    if (elements.streakCount) elements.streakCount.textContent = session.streak || 0;

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

// ---------- Attach event listeners ----------
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

// ---------- Start ----------
document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
  initQuiz();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopTimer();
  clearNextTimer();
});
