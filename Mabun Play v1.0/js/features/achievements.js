// js/features/achievements.js
import { showModal } from '../utils/modal.js';
import { formatShortDate } from '../utils/formatters.js';

document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    unlockedCount: document.getElementById('unlockedCount'),
    totalCount: document.getElementById('totalCount'),
    completionPercent: document.getElementById('completionPercent'),
    ringProgress: document.querySelector('.ring-progress'),
    achievementsGrid: document.getElementById('achievementsGrid'),
    loadingSpinner: document.getElementById('loadingSpinner')
  };

  if (elements.loadingSpinner) elements.loadingSpinner.style.display = 'block';

  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error('Supabase client not available');
    showModal({ title: 'Error', message: 'Configuration error. Please refresh.', confirmText: 'OK' });
    if (elements.loadingSpinner) elements.loadingSpinner.style.display = 'none';
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: achievements, error } = await supabase
      .rpc('get_user_achievements', { user_id: user.id });
    if (error) throw error;

    renderAchievements(achievements);
  } catch (error) {
    console.error('Failed to load achievements:', error);
    showModal({ title: 'Error', message: 'Could not load achievements. Please try again.', confirmText: 'OK' });
  } finally {
    if (elements.loadingSpinner) elements.loadingSpinner.style.display = 'none';
  }

  function renderAchievements(data) {
    const unlocked = data.unlocked || 0;
    const total = data.total || 0;
    const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    if (elements.unlockedCount) elements.unlockedCount.textContent = unlocked;
    if (elements.totalCount) elements.totalCount.textContent = total;
    if (elements.completionPercent) elements.completionPercent.textContent = percent + '%';

    if (elements.ringProgress) {
      const circumference = 2 * Math.PI * 54;
      const offset = circumference * (1 - percent / 100);
      elements.ringProgress.style.strokeDasharray = `${circumference}`;
      elements.ringProgress.style.strokeDashoffset = offset;
    }

    if (!elements.achievementsGrid) return;
    elements.achievementsGrid.innerHTML = '';

    if (!data.achievements || data.achievements.length === 0) {
      elements.achievementsGrid.innerHTML = '<div class="empty-state">No achievements yet. Keep playing!</div>';
      return;
    }

    data.achievements.forEach(ach => {
      const card = document.createElement('div');
      card.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
      const tier = ach.tier || (ach.rarity ? mapRarityToTier(ach.rarity) : 'bronze');
      card.setAttribute('data-tier', tier);

      const header = document.createElement('div');
      header.className = 'achievement-header';

      const iconDiv = document.createElement('div');
      iconDiv.className = `achievement-icon ${ach.unlocked ? 'unlocked' : ''}`;
      iconDiv.innerHTML = `<iconify-icon icon="${ach.icon || 'solar:cup-star-bold'}"></iconify-icon>`;

      const title = document.createElement('h3');
      title.className = 'achievement-title';
      title.textContent = ach.name;

      header.appendChild(iconDiv);
      header.appendChild(title);
      card.appendChild(header);

      const desc = document.createElement('p');
      desc.className = 'achievement-description';
      desc.textContent = ach.description;
      card.appendChild(desc);

      const meta = document.createElement('div');
      meta.className = 'achievement-meta';

      const raritySpan = document.createElement('span');
      raritySpan.className = 'achievement-rarity';
      raritySpan.textContent = ach.rarity ? ach.rarity.toUpperCase() : tier.toUpperCase();
      meta.appendChild(raritySpan);

      if (ach.unlocked && ach.unlocked_at) {
        const dateSpan = document.createElement('span');
        dateSpan.className = 'achievement-date';
        dateSpan.innerHTML = `<iconify-icon icon="solar:calendar-linear"></iconify-icon> ${formatShortDate(ach.unlocked_at)}`;
        meta.appendChild(dateSpan);
      }
      card.appendChild(meta);

      if (ach.progress) {
        const progressDiv = document.createElement('div');
        progressDiv.className = 'achievement-progress';

        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.innerHTML = `<span>Progress</span><span>${ach.progress.current} / ${ach.progress.max}</span>`;

        const barBg = document.createElement('div');
        barBg.className = 'progress-bar-bg';

        const barFill = document.createElement('div');
        barFill.className = 'progress-bar-fill';
        const progPercent = (ach.progress.current / ach.progress.max) * 100;
        barFill.style.width = `${progPercent}%`;

        barBg.appendChild(barFill);
        progressDiv.appendChild(progressText);
        progressDiv.appendChild(barBg);
        card.appendChild(progressDiv);
      }

      if (ach.unlocked) {
        const badge = document.createElement('span');
        badge.className = 'achievement-badge';
        badge.textContent = 'Unlocked';
        card.appendChild(badge);
      }

      elements.achievementsGrid.appendChild(card);
    });
  }

  function mapRarityToTier(rarity) {
    switch (rarity) {
      case 'common': return 'bronze';
      case 'rare': return 'silver';
      case 'epic': return 'gold';
      case 'legendary': return 'platinum';
      default: return 'bronze';
    }
  }
});
