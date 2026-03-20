import { showModal } from '../utils/modal.js';
import { formatCurrency } from '../utils/formatters.js';
import { getQueryParam } from '../utils/helpers.js';

const elements = {
  avatarImg: document.getElementById('avatarImg'),
  avatarUploadBtn: document.getElementById('avatarUploadBtn'),
  profileName: document.getElementById('profileName'),
  userIdSpan: document.getElementById('userId'),
  statWinnings: document.getElementById('statWinnings'),
  statPlayed: document.getElementById('statPlayed'),
  statRank: document.getElementById('statRank'),
  accountUsername: document.getElementById('accountUsername'),
  accountEmail: document.getElementById('accountEmail'),
  accountPhone: document.getElementById('accountPhone'),
  displayUsername: document.getElementById('displayUsername'),
  displayEmail: document.getElementById('displayEmail'),
  editUsernameLink: document.getElementById('editUsername'),
  editEmailLink: document.getElementById('editEmail'),
  usernameDisplay: document.getElementById('usernameDisplay'),
  emailDisplay: document.getElementById('emailDisplay'),
  editProfileContainer: document.getElementById('editProfileContainer'),
  editProfileBtn: document.getElementById('editProfileBtn'),
  backBtn: document.getElementById('backBtn'),
  viewAllAchievements: document.getElementById('viewAllAchievements'),
  achievementsList: document.getElementById('achievementsList'),
  followersCount: document.getElementById('followersCount'),
  followingCount: document.getElementById('followingCount'),
  followBtn: document.getElementById('followBtn'),
  kycStatus: document.getElementById('kycStatus'),
  kycForm: document.getElementById('kycForm'),
  fullName: document.getElementById('fullName'),
  idNumber: document.getElementById('idNumber'),
  idDocument: document.getElementById('idDocument'),
  uploadPreview: document.getElementById('uploadPreview'),
  submitKycBtn: document.getElementById('submitKycBtn'),
  emailVerificationBanner: document.getElementById('emailVerificationBanner'),
  resendVerificationBtn: document.getElementById('resendVerificationBtn'),
};

let profileUser = null;
let currentUser = null;
let isOwnProfile = false;
let loadingSwal = null;

function setLoading(isLoading) {
  if (isLoading) {
    loadingSwal = Swal.fire({
      title: 'Loading...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
  } else {
    if (loadingSwal) Swal.close();
    loadingSwal = null;
  }
}

function showToast(title, message, icon = 'success') {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title: message,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
  });
}

async function fetchCurrentUser() {
  const supabase = window.supabaseClient;
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single();
  if (error) {
    console.error('Error fetching current user profile:', error);
    return null;
  }
  return { ...session.user, ...profile };
}

async function fetchProfile(userId = null) {
  setLoading(true);
  const supabase = window.supabaseClient;
  if (!supabase) return null;
  try {
    if (userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      if (error) throw error;
      return data;
    }
  } catch (err) {
    console.error('Error fetching profile:', err);
    if (err.status === 404) {
      showToast('Error', 'User not found.', 'error');
      setTimeout(() => { window.location.href = '/profile.html'; }, 1500);
    } else {
      showToast('Error', 'Could not load profile. Please refresh.', 'error');
    }
    return null;
  } finally {
    setLoading(false);
  }
}

async function fetchFollowStats(userId) {
  const supabase = window.supabaseClient;
  if (!supabase) return { followers: 0, following: 0 };
  try {
    const { data, error } = await supabase
      .rpc('get_follow_stats', { user_id: userId });
    if (error) throw error;
    return { followers: data.followers, following: data.following };
  } catch (err) {
    console.error('Error fetching follow stats:', err);
    return { followers: 0, following: 0 };
  }
}

function renderProfile() {
  if (!profileUser) return;

  elements.profileName.textContent = profileUser.username;
  elements.userIdSpan.textContent = `User ID: ${profileUser.user_id}`;
  elements.avatarImg.src = profileUser.avatar_url || '/assets/images/default-avatar.png';
  elements.statWinnings.textContent = formatCurrency(profileUser.winnings || 0, true);
  elements.statPlayed.textContent = profileUser.played || 0;
  elements.statRank.textContent = '#' + (profileUser.rank || 0);
  elements.accountPhone.textContent = profileUser.phone || '—';
  elements.displayUsername.textContent = profileUser.username;
  elements.displayEmail.textContent = profileUser.email || '—';

  if (isOwnProfile) {
    elements.accountUsername.textContent = profileUser.username;
    elements.accountEmail.textContent = profileUser.email || '—';
    elements.editUsernameLink.style.display = 'flex';
    elements.editEmailLink.style.display = 'flex';
    elements.usernameDisplay.style.display = 'none';
    elements.emailDisplay.style.display = 'none';
    elements.editProfileContainer.style.display = 'block';
    elements.avatarUploadBtn.style.display = 'flex';
    addLogoutButton();
  } else {
    elements.editUsernameLink.style.display = 'none';
    elements.editEmailLink.style.display = 'none';
    elements.usernameDisplay.style.display = 'flex';
    elements.emailDisplay.style.display = 'flex';
    elements.editProfileContainer.style.display = 'none';
    elements.avatarUploadBtn.style.display = 'none';
  }

  if (elements.achievementsList) {
    if (profileUser.achievements && profileUser.achievements.length) {
      elements.achievementsList.innerHTML = profileUser.achievements.map(ach => `
        <div class="achievement-badge">
          <div class="badge-icon ${ach.iconClass || ''}">
            <iconify-icon icon="${ach.icon}"></iconify-icon>
          </div>
          <span>${ach.name}</span>
        </div>
      `).join('');
    } else {
      elements.achievementsList.innerHTML = '<p class="text-muted">No achievements yet.</p>';
    }
  }

  fetchFollowStats(profileUser.user_id).then(stats => {
    elements.followersCount.textContent = stats.followers;
    elements.followingCount.textContent = stats.following;
  });

  if (!isOwnProfile && currentUser) {
    elements.followBtn.style.display = 'block';
    elements.followBtn.textContent = 'Follow';
    elements.followBtn.className = 'btn btn-outline';
  } else {
    elements.followBtn.style.display = 'none';
  }
}

function addLogoutButton() {
  if (document.getElementById('logoutBtn')) return;
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logoutBtn';
  logoutBtn.className = 'btn btn-outline btn-full';
  logoutBtn.innerHTML = 'Logout <iconify-icon icon="solar:logout-2-linear"></iconify-icon>';
  logoutBtn.addEventListener('click', handleLogout);
  const container = document.querySelector('.profile-main');
  if (container) container.appendChild(logoutBtn);
}

async function handleLogout() {
  const result = await Swal.fire({
    title: 'Logout',
    text: 'Are you sure you want to logout?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, logout',
    cancelButtonText: 'Cancel',
  });
  if (result.isConfirmed) {
    const supabase = window.supabaseClient;
    if (supabase) await supabase.auth.signOut();
    window.location.href = 'login.html';
  }
}

async function handleFollow() {
  if (!currentUser || !profileUser) return;

  const isFollowing = elements.followBtn.textContent === 'Unfollow';
  const supabase = window.supabaseClient;
  if (!supabase) return;

  elements.followBtn.disabled = true;

  try {
    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.user_id)
        .eq('following_id', profileUser.user_id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUser.user_id, following_id: profileUser.user_id });
      if (error) throw error;
    }

    elements.followBtn.textContent = isFollowing ? 'Follow' : 'Unfollow';
    elements.followBtn.className = isFollowing ? 'btn btn-outline' : 'btn btn-primary';

    const stats = await fetchFollowStats(profileUser.user_id);
    elements.followersCount.textContent = stats.followers;
    showToast('Success', isFollowing ? 'Unfollowed' : 'Following', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error', `Could not ${isFollowing ? 'unfollow' : 'follow'} user.`, 'error');
  } finally {
    elements.followBtn.disabled = false;
  }
}

async function uploadAvatar(file) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error('Supabase client not available');
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error('Not authenticated');
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.data.user.id}/${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file);
  if (uploadError) throw uploadError;
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('user_id', user.data.user.id);
  if (updateError) throw updateError;
  return publicUrl;
}

async function updateProfileField(field, value) {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error('Supabase client not available');
  try {
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('user_id', currentUser.user_id)
      .select()
      .single();
    if (error) throw error;
    profileUser = { ...profileUser, ...updated };
    currentUser = profileUser;
    renderProfile();
    showToast('Success', `${field} updated!`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Error', `Could not update ${field}.`, 'error');
  }
}

function setupAvatarUpload() {
  elements.avatarUploadBtn.addEventListener('click', async () => {
    const { value: file } = await Swal.fire({
      title: 'Upload Profile Picture',
      input: 'file',
      inputAttributes: { accept: 'image/*' },
      showCancelButton: true,
      confirmButtonText: 'Upload',
      cancelButtonText: 'Cancel',
      inputValidator: (value) => {
        if (!value) return 'Please select an image.';
      },
    });
    if (file) {
      try {
        const url = await uploadAvatar(file);
        elements.avatarImg.src = url;
        showToast('Success', 'Avatar updated!', 'success');
      } catch (err) {
        showToast('Error', 'Could not upload avatar.', 'error');
      }
    }
  });
}

function setupEditUsername() {
  elements.editUsernameLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const { value: newUsername } = await Swal.fire({
      title: 'Edit Username',
      input: 'text',
      inputLabel: 'New username',
      inputValue: profileUser.username,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Username cannot be empty.';
        if (value.length < 3) return 'Username must be at least 3 characters.';
      },
    });
    if (newUsername && newUsername !== profileUser.username) {
      await updateProfileField('username', newUsername);
    }
  });
}

function setupEditEmail() {
  elements.editEmailLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const { value: newEmail } = await Swal.fire({
      title: 'Edit Email',
      input: 'email',
      inputLabel: 'New email address',
      inputValue: profileUser.email || '',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Email cannot be empty.';
        if (!/^\S+@\S+\.\S+$/.test(value)) return 'Please enter a valid email.';
      },
    });
    if (newEmail && newEmail !== profileUser.email) {
      await updateProfileField('email', newEmail);
    }
  });
}

function setupEditProfile() {
  elements.editProfileBtn.addEventListener('click', async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Edit Profile',
      html: `
        <input id="swal-username" class="swal2-input" placeholder="Username" value="${profileUser.username}">
        <input id="swal-email" class="swal2-input" placeholder="Email" value="${profileUser.email || ''}">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Save',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        const username = document.getElementById('swal-username').value;
        const email = document.getElementById('swal-email').value;
        if (!username) {
          Swal.showValidationMessage('Username cannot be empty');
          return false;
        }
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
          Swal.showValidationMessage('Please enter a valid email');
          return false;
        }
        return { username, email };
      },
    });
    if (formValues) {
      if (formValues.username !== profileUser.username) {
        await updateProfileField('username', formValues.username);
      }
      if (formValues.email !== profileUser.email) {
        await updateProfileField('email', formValues.email);
      }
    }
  });
}

function setupBackButton() {
  elements.backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.history.back();
  });
}

function setupAchievements() {
  elements.viewAllAchievements.addEventListener('click', (e) => {
    e.preventDefault();
    const userIdParam = !isOwnProfile ? `?userId=${profileUser.user_id}` : '';
    window.location.href = `achievements.html${userIdParam}`;
  });
}

function setupFollow() {
  elements.followBtn.addEventListener('click', handleFollow);
}

async function loadKycStatus() {
  const supabase = window.supabaseClient;
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('kyc_submissions')
      .select('status')
      .eq('user_id', currentUser.user_id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      elements.kycStatus.innerHTML = '';
      elements.kycForm.style.display = 'block';
    } else if (data.status === 'verified') {
      elements.kycStatus.className = 'kyc-status verified';
      elements.kycStatus.innerHTML = '<iconify-icon icon="solar:verified-check-bold"></iconify-icon> Verified';
      elements.kycForm.style.display = 'none';
    } else if (data.status === 'pending') {
      elements.kycStatus.className = 'kyc-status pending';
      elements.kycStatus.innerHTML = '<iconify-icon icon="solar:hourglass-bold"></iconify-icon> Verification pending';
      elements.kycForm.style.display = 'none';
    } else if (data.status === 'rejected') {
      elements.kycStatus.className = 'kyc-status rejected';
      elements.kycStatus.innerHTML = '<iconify-icon icon="solar:close-circle-bold"></iconify-icon> Verification rejected. Please resubmit.';
      elements.kycForm.style.display = 'block';
    }
  } catch (err) {
    console.error('Failed to load KYC status:', err);
  }
}

async function submitKyc(e) {
  e.preventDefault();
  const fullName = elements.fullName.value.trim();
  const idNumber = elements.idNumber.value.trim();
  const file = elements.idDocument.files[0];

  if (!fullName || !idNumber || !file) {
    showToast('Error', 'Please fill all fields and select an image.', 'error');
    return;
  }

  const supabase = window.supabaseClient;
  if (!supabase) return;

  elements.submitKycBtn.disabled = true;
  elements.submitKycBtn.innerHTML = '<span class="loader"></span> Submitting...';

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const fileExt = file.name.split('.').pop();
    const fileName = `kyc/${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('kyc')
      .upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('kyc').getPublicUrl(fileName);

    const { error: insertError } = await supabase
      .from('kyc_submissions')
      .insert({
        user_id: user.id,
        full_name: fullName,
        id_number: idNumber,
        document_url: publicUrl,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      });
    if (insertError) throw insertError;

    showToast('Success', 'KYC submitted successfully. Awaiting verification.', 'success');
    loadKycStatus();
  } catch (err) {
    showToast('Error', err.message || 'Submission failed', 'error');
  } finally {
    elements.submitKycBtn.disabled = false;
    elements.submitKycBtn.innerHTML = 'Submit Verification';
  }
}

function setupKycPreview() {
  if (elements.idDocument) {
    elements.idDocument.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && elements.uploadPreview) {
        const reader = new FileReader();
        reader.onload = (event) => {
          elements.uploadPreview.innerHTML = `<img src="${event.target.result}" alt="ID preview">`;
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

async function checkEmailVerification() {
  const supabase = window.supabaseClient;
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user.email && !user.email_confirmed_at && elements.emailVerificationBanner) {
      elements.emailVerificationBanner.style.display = 'flex';
    } else if (elements.emailVerificationBanner) {
      elements.emailVerificationBanner.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to check email verification:', err);
  }
}

function setupResendVerification() {
  if (elements.resendVerificationBtn) {
    elements.resendVerificationBtn.addEventListener('click', async () => {
      const supabase = window.supabaseClient;
      if (!supabase) return;
      try {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: currentUser.email,
        });
        if (error) throw error;
        showToast('Success', 'Verification email sent!', 'success');
      } catch (err) {
        showToast('Error', err.message || 'Failed to send', 'error');
      }
    });
  }
}

(async function init() {
  currentUser = await fetchCurrentUser();
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  const profileUserId = getQueryParam('userId');
  isOwnProfile = !profileUserId || profileUserId === currentUser.user_id;
  const targetId = isOwnProfile ? null : profileUserId;

  profileUser = await fetchProfile(targetId);
  if (!profileUser) return;

  renderProfile();

  if (isOwnProfile) {
    setupAvatarUpload();
    setupEditUsername();
    setupEditEmail();
    setupEditProfile();
    loadKycStatus();
    setupKycPreview();
    if (elements.kycForm) {
      elements.kycForm.addEventListener('submit', submitKyc);
    }
    checkEmailVerification();
    setupResendVerification();
  }
  setupBackButton();
  setupAchievements();
  setupFollow();
})();
