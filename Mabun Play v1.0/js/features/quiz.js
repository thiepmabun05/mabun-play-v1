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
let timerInterval = null;
let answerSubmitted = false;
let loading = false;
let waitingForNext = false;
let pollInterval = null;
let quizSubscription = null;

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  quizId = urlParams.get('id');
  sessionId = urlParams.get('session');
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function stopPoll() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function fetchCurrentState() {
  const supabase = window.supabaseClient;
  if (!supabase) return;
  try {
    const { data, error } = await supabase.rpc('get_current_question', { p_session_id: sessionId });
    if (error) throw error;

    if (data.finished) {
      window.location.href = `results.html?id=${quizId}&session=${sessionId}`;
      return;
    }

    if (data.waiting) {
      waitingForNext = true;
      const nextAt = new Date(data.next_question_at);
      const diff = Math.max(0, nextAt - Date.now());
      updateTimerDisplay(Math.floor(diff / 1000));
      // Poll again in 1 second
      pollInterval = setTimeout(fetchCurrentState, 1000);
      return;
    }

    waitingForNext = false;
    currentQuestion = data.question;
    if (elements.scoreValue) elements.scoreValue.textContent = data.score;
    if (elements.streakCount) elements.streakCount.textContent = data.streak;
    if (elements.questionCounter) {
      elements.questionCounter.textContent = `${data.current_index + 1}/${data.total_questions}`;
    }

    renderQuestion(currentQuestion);
    startTimer(data.time_left);
  } catch (err) {
    console.error(err);
    await showModal({ title: 'Error', message: err.message, confirmText: 'OK' });
    window.location.href = 'dashboard.html';
  }
}

function renderQuestion(question) {
  if (!question) return;

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
}

function startTimer(seconds) {
  stopTimer();
  timeLeft = seconds;
  updateTimerDisplay(timeLeft);

  timerInterval = setInterval(() => {
    if (waitingForNext) return;
    timeLeft -= 1;
    updateTimerDisplay(timeLeft);

    if (timeLeft <= 0 && !answerSubmitted && !loading) {
      stopTimer();
      submitAnswer(null);
    }
  }, 1000);
}

function updateTimerDisplay(seconds) {
  if (elements.timerText) elements.timerText.textContent = seconds;
  if (elements.timerProgress && currentQuestion?.timeAllowed) {
    const total = currentQuestion.timeAllowed;
    const circumference = 2 * Math.PI * 18;
    const offset = circumference * (1 - seconds / total);
    elements.timerProgress.style.strokeDashoffset = offset;

    if (seconds <= 3) {
      elements.timerProgress.style.stroke = 'var(--error)';
    } else if (seconds <= 5) {
      elements.timerProgress.style.stroke = 'var(--warning)';
    } else {
      elements.timerProgress.style.stroke = 'var(--success)';
    }
  }
}

async function submitAnswer(optionId) {
  if (answerSubmitted || loading || waitingForNext) return;
  answerSubmitted = true;
  stopTimer();

  elements.optionBtns.forEach(btn => btn.disabled = true);

  try {
    const supabase = window.supabaseClient;
    const { data, error } = await supabase.rpc('submit_answer_for_current', {
      p_session_id: sessionId,
      p_option_id: optionId
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);

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

    // Short pause to show feedback, then refetch
    setTimeout(() => {
      answerSubmitted = false;
      fetchCurrentState();
    }, 500);
  } catch (err) {
    console.error(err);
    await showModal({ title: 'Submission Error', message: err.message, confirmText: 'OK' });
    setLoading(false);
    answerSubmitted = false;
  }
}

function onOptionClick(e) {
  const btn = e.currentTarget;
  if (btn.disabled || answerSubmitted || loading || waitingForNext) return;
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
    await fetchCurrentState();

    // Subscribe to quiz changes to sync timer
    const supabase = window.supabaseClient;
    quizSubscription = supabase
      .channel(`quiz-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quizzes',
          filter: `id=eq.${quizId}`,
        },
        (payload) => {
          // If we are waiting, the timer will be updated on the next poll.
          // For active questions, we can adjust the local timer if the server's next_question_at changes.
          const newNextAt = payload.new.next_question_at;
          if (newNextAt && !waitingForNext) {
            const remaining = Math.max(0, (new Date(newNextAt) - Date.now()) / 1000);
            // If the difference is significant, sync
            if (Math.abs(remaining - timeLeft) > 1) {
              stopTimer();
              startTimer(remaining);
            }
          }
        }
      )
      .subscribe();

    // Poll every 5 seconds as a fallback (but the timer itself will handle transitions)
    pollInterval = setInterval(fetchCurrentState, 5000);
  } catch (err) {
    console.error(err);
    await showModal({ title: 'Error', message: err.message, confirmText: 'OK' });
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

function setLoading(isLoading) {
  loading = isLoading;
  elements.optionBtns.forEach(btn => btn.disabled = isLoading);
}

document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
  initQuiz();
});

window.addEventListener('beforeunload', () => {
  stopTimer();
  stopPoll();
  if (quizSubscription) quizSubscription.unsubscribe();
});
