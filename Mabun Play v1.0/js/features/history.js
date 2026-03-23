// js/features/history.js
import { showModal } from '../utils/modal.js';
import { formatCurrency, formatShortDate } from '../utils/formatters.js';
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';

document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    periodTabs: document.querySelectorAll('.period-tab'),
    totalEarnings: document.getElementById('totalEarnings'),
    avgScore: document.getElementById('avgScore'),
    quizzesPlayed: document.getElementById('quizzesPlayed'),
    bestRank: document.getElementById('bestRank'),
    trendEarnings: document.getElementById('trendEarnings'),
    trendAvg: document.getElementById('trendAvg'),
    trendPlayed: document.getElementById('trendPlayed'),
    trendRank: document.getElementById('trendRank'),
    recentQuizzes: document.getElementById('recentQuizzes')
  };

  let chart;
  let currentPeriod = 'day';

  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error('Supabase client not available');
    showModal({ title: 'Error', message: 'Supabase client not loaded.', confirmText: 'OK' });
    return;
  }

  async function loadHistory(period) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('get_user_history', {
        p_user_id: user.id,
        p_period: period
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      updateMetrics(data.metrics);
      updateChart(data.chartData, period);
      updateRecent(data.recent);
    } catch (error) {
      console.error('Error loading history:', error);
      showModal({ title: 'Error', message: error.message || 'Could not load performance data.', confirmText: 'OK' });
    }
  }

  function updateMetrics(metrics) {
    if (!metrics) return;

    elements.totalEarnings.textContent = formatCurrency(metrics.totalEarnings || 0);
    elements.avgScore.textContent = (metrics.avgScore || 0).toFixed(1);
    elements.quizzesPlayed.textContent = metrics.quizzesPlayed || 0;
    elements.bestRank.textContent = '#' + (metrics.bestRank || 0);

    // Trends
    const trendEarn = metrics.trendEarnings;
    const trendAvg = metrics.trendAvg;
    const trendPlay = metrics.trendPlayed;
    const trendRank = metrics.trendRank;

    elements.trendEarnings.innerHTML = trendEarn
      ? `<iconify-icon icon="solar:arrow-${trendEarn > 0 ? 'up' : 'down'}-bold"></iconify-icon> ${Math.abs(trendEarn).toFixed(1)}%`
      : '';
    elements.trendAvg.innerHTML = trendAvg
      ? `<iconify-icon icon="solar:arrow-${trendAvg > 0 ? 'up' : 'down'}-bold"></iconify-icon> ${Math.abs(trendAvg).toFixed(1)}%`
      : '';
    elements.trendPlayed.innerHTML = trendPlay
      ? `<iconify-icon icon="solar:arrow-${trendPlay > 0 ? 'up' : 'down'}-bold"></iconify-icon> ${Math.abs(trendPlay).toFixed(1)}%`
      : '';
    elements.trendRank.innerHTML = trendRank
      ? `<iconify-icon icon="solar:arrow-${trendRank > 0 ? 'up' : 'down'}-bold"></iconify-icon> ${Math.abs(trendRank).toFixed(1)}%`
      : '';
  }

  function updateChart(chartData, period) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    if (chart) chart.destroy();

    if (!chartData || chartData.length === 0) {
      // Empty state
      new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: { responsive: true, maintainAspectRatio: false }
      });
      return;
    }

    const labels = chartData.map(d => d.label);
    const earnings = chartData.map(d => d.earnings);

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Earnings (SSP)',
          data: earnings,
          borderColor: '#680080',
          backgroundColor: 'rgba(104,0,128,0.1)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: '#680080',
          pointBorderColor: '#fff',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${formatCurrency(ctx.raw)}` } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (val) => formatCurrency(val, true) } }
        }
      }
    });
  }

  function updateRecent(recent) {
    if (!elements.recentQuizzes) return;
    if (!recent || recent.length === 0) {
      elements.recentQuizzes.innerHTML = '<tr><td colspan="4" class="empty">No recent quizzes</td></tr>';
      return;
    }

    elements.recentQuizzes.innerHTML = recent.map(q => `
      <tr>
        <td>${formatShortDate(q.date)}</td>
        <td>${escapeHtml(q.quizName)}</td>
        <td>${q.score}</td>
        <td>${q.earnings ? formatCurrency(q.earnings) : '-'}</td>
      </tr>
    `).join('');
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

  // Attach period tab listeners
  elements.periodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.periodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPeriod = tab.dataset.period;
      loadHistory(currentPeriod);
    });
  });

  // Initial load
  loadHistory(currentPeriod);
});
