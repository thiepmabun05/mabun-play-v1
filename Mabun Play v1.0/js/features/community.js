// js/features/community.js
import { showModal } from '../utils/modal.js';
import { throttle } from '../utils/helpers.js';

// ---------- Helper: format time ----------
function formatTime(dateString) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Just now';
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  if (diffWeeks < 4) return `${diffWeeks}w`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------- Helper: escape HTML ----------
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    postInput: document.getElementById('postInput'),
    uploadImageLabel: document.getElementById('uploadImageLabel'),
    createPostBtn: document.getElementById('createPostBtn'),
    feedTabs: document.querySelectorAll('.feed-tab'),
    postsFeed: document.getElementById('postsFeed'),
    feedLoader: document.getElementById('feedLoader'),
    feedEnd: document.getElementById('feedEnd'),
    backToTopBtn: document.getElementById('backToTopBtn'),
    postImageUpload: document.getElementById('postImageUpload'),
    imagePreview: document.getElementById('imagePreview'),
    postAvatar: document.querySelector('.create-post-card .post-avatar'),
  };

  let currentFeed = 'latest';
  let page = 1;
  let loading = false;
  let hasMore = true;
  let selectedImageFile = null;
  let currentUserId = null;
  let currentUserProfile = null;

  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error('Supabase client not available');
    showModal({ title: 'Error', message: 'Configuration error. Please refresh.', confirmText: 'OK' });
    return;
  }

  // ---------- Ensure the current user has a profile (create if missing) ----------
  async function ensureCurrentUserProfile() {
    if (!currentUserId) return;
    const { data: existing, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', currentUserId)
      .maybeSingle();

    if (error) {
      console.error('Error checking profile:', error);
      return;
    }
    if (!existing) {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      const username = user.email ? user.email.split('@')[0] : `user_${currentUserId.slice(0, 8)}`;
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: currentUserId,
          username,
          email: user.email,
          phone: null,
          provider: null,
          avatar_url: null,
          winnings: 0,
          played: 0,
          rank: 0,
          wallet_balance: 0,
        });
      if (insertError) console.error('Failed to create profile:', insertError);
      else console.log('Created missing profile for current user');
    }
  }

  // ---------- Authentication & User Data ----------
  async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    currentUserId = user.id;
    await ensureCurrentUserProfile(); // ensure profile exists
    await getCurrentUserProfile();   // fetch it
    return user;
  }

  async function getCurrentUserProfile() {
    if (!currentUserId) return null;
    if (currentUserProfile) return currentUserProfile;
    const { data, error } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', currentUserId)
      .single();
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    currentUserProfile = data;
    // Update avatar in create‑post card
    if (elements.postAvatar) {
      elements.postAvatar.src = currentUserProfile.avatar_url || '/assets/images/default-avatar.png';
    }
    return currentUserProfile;
  }

  async function getFollowingIds() {
    if (!currentUserId) return [];
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);
    if (error) return [];
    return data.map(f => f.following_id);
  }

  // ---------- Fetch Profiles for a list of user IDs ----------
  async function fetchProfiles(userIds) {
    if (!userIds.length) return {};
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    if (error) {
      console.error('Error fetching profiles:', error);
      return {};
    }
    const map = {};
    data.forEach(p => { map[p.id] = p; });
    return map;
  }

  // ---------- Load Posts ----------
  async function loadPosts(feed, pageNum) {
    if (loading || !hasMore) return;
    loading = true;
    elements.feedLoader.style.display = 'block';

    try {
      let query = supabase
        .from('posts')
        .select('id, content, image_url, user_id, created_at, likes_count, comments_count')
        .order('created_at', { ascending: false });

      if (feed === 'trending') {
        query = supabase
          .from('posts')
          .select('id, content, image_url, user_id, created_at, likes_count, comments_count')
          .order('likes_count', { ascending: false })
          .order('comments_count', { ascending: false });
      } else if (feed === 'following') {
        const following = await getFollowingIds();
        if (following.length === 0) {
          elements.postsFeed.innerHTML = '<div class="empty-state">You are not following anyone. Follow users to see their posts.</div>';
          loading = false;
          elements.feedLoader.style.display = 'none';
          return;
        }
        query = supabase
          .from('posts')
          .select('id, content, image_url, user_id, created_at, likes_count, comments_count')
          .in('user_id', following)
          .order('created_at', { ascending: false });
      }

      const { data: posts, error } = await query.range((pageNum - 1) * 10, pageNum * 10 - 1);
      if (error) throw error;

      if (posts.length === 0 && pageNum === 1) {
        elements.postsFeed.innerHTML = '<div class="empty-state">No posts yet. Be the first!</div>';
      } else {
        // Fetch profiles for all users in posts
        const userIds = [...new Set(posts.map(p => p.user_id))];
        const profileMap = await fetchProfiles(userIds);

        // Check likes for current user
        const likedMap = {};
        if (currentUserId) {
          const { data: likes } = await supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', currentUserId)
            .in('post_id', posts.map(p => p.id));
          if (likes) {
            likes.forEach(like => { likedMap[like.post_id] = true; });
          }
        }

        for (const post of posts) {
          const profile = profileMap[post.user_id] || { username: 'Unknown', avatar_url: null };
          const postWithProfile = {
            ...post,
            profiles: profile,
            user_liked: likedMap[post.id] || false,
          };
          elements.postsFeed.appendChild(createPostElement(postWithProfile));
        }
        hasMore = posts.length === 10;
        page = pageNum;
      }
      elements.feedEnd.style.display = hasMore ? 'none' : 'block';
    } catch (error) {
      console.error('Failed to load feed:', error);
      showModal({ title: 'Error', message: error.message || 'Failed to load feed.', confirmText: 'OK' });
    } finally {
      loading = false;
      elements.feedLoader.style.display = 'none';
    }
  }

  // ---------- Create a Post Element ----------
  function createPostElement(post) {
    const authorName = post.profiles?.username || 'Unknown';
    const authorAvatar = post.profiles?.avatar_url || '/assets/images/default-avatar.png';
    const createdAt = post.created_at;
    const likeCount = post.likes_count || 0;
    const commentCount = post.comments_count || 0;
    const userLiked = post.user_liked || false;

    const div = document.createElement('div');
    div.className = 'post-card';
    div.dataset.postId = post.id;
    div.innerHTML = `
      <div class="post-header">
        <a href="profile.html?userId=${post.user_id}" class="post-avatar-link">
          <img src="${authorAvatar}" alt="" class="post-avatar">
        </a>
        <div class="post-meta">
          <a href="profile.html?userId=${post.user_id}" class="post-author">${escapeHtml(authorName)}</a>
          <span class="post-time">${formatTime(createdAt)}</span>
        </div>
      </div>
      <div class="post-content">${escapeHtml(post.content) || ''}</div>
      ${post.image_url ? `<img src="${post.image_url}" alt="" class="post-image">` : ''}
      <div class="post-actions">
        <button class="post-action like-btn" data-id="${post.id}">
          <iconify-icon icon="${userLiked ? 'solar:heart-bold' : 'solar:heart-linear'}"></iconify-icon>
          <span>${likeCount}</span>
        </button>
        <button class="post-action comment-toggle" data-id="${post.id}">
          <iconify-icon icon="solar:chat-round-linear"></iconify-icon>
          <span>${commentCount}</span>
        </button>
        <button class="post-action share-btn" data-id="${post.id}">
          <iconify-icon icon="solar:share-linear"></iconify-icon>
        </button>
      </div>
      <div class="comments-section" style="display: none;">
        <div class="comments-list" id="comments-${post.id}"></div>
        <div class="add-comment">
          <input type="text" class="comment-input" placeholder="Write a comment..." data-post-id="${post.id}">
          <button class="comment-submit" data-post-id="${post.id}">Post</button>
        </div>
      </div>
    `;

    // Like button
    const likeBtn = div.querySelector('.like-btn');
    likeBtn.addEventListener('click', async () => {
      if (!currentUserId) {
        await showModal({ title: 'Login Required', message: 'Please log in to like posts.', confirmText: 'OK' });
        return;
      }
      const isLiked = userLiked;
      try {
        if (isLiked) {
          await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
          likeBtn.querySelector('span').textContent = likeCount - 1;
          likeBtn.querySelector('iconify-icon').setAttribute('icon', 'solar:heart-linear');
        } else {
          await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
          likeBtn.querySelector('span').textContent = likeCount + 1;
          likeBtn.querySelector('iconify-icon').setAttribute('icon', 'solar:heart-bold');
        }
      } catch (error) {
        console.error('Like failed:', error);
      }
    });

    // Comment toggle
    const commentToggle = div.querySelector('.comment-toggle');
    const commentsSection = div.querySelector('.comments-section');
    commentToggle.addEventListener('click', async () => {
      if (commentsSection.style.display === 'none') {
        commentsSection.style.display = 'block';
        await loadComments(post.id);
      } else {
        commentsSection.style.display = 'none';
      }
    });

    // Share button
    const shareBtn = div.querySelector('.share-btn');
    shareBtn.addEventListener('click', async () => {
      const url = `${window.location.origin}/post.html?id=${post.id}`;
      try {
        await navigator.clipboard.writeText(url);
        showModal({ title: 'Link Copied', message: 'Post link copied to clipboard!', confirmText: 'OK' });
      } catch (err) {
        showModal({ title: 'Error', message: 'Could not copy link.', confirmText: 'OK' });
      }
    });

    // Comment submit
    const commentInput = div.querySelector('.comment-input');
    const commentSubmit = div.querySelector('.comment-submit');
    commentSubmit.addEventListener('click', async () => {
      if (!currentUserId) {
        await showModal({ title: 'Login Required', message: 'Please log in to comment.', confirmText: 'OK' });
        return;
      }
      const text = commentInput.value.trim();
      if (!text) return;
      try {
        await supabase.from('comments').insert({
          post_id: post.id,
          user_id: currentUserId,
          text,
        });
        commentInput.value = '';
        await loadComments(post.id);
        const countSpan = commentToggle.querySelector('span');
        countSpan.textContent = parseInt(countSpan.textContent) + 1;
      } catch (error) {
        showModal({ title: 'Error', message: error.message, confirmText: 'OK' });
      }
    });

    return div;
  }

  // ---------- Load Comments (with nested replies) ----------
  async function loadComments(postId) {
  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, text, user_id, created_at, parent_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const commentsList = document.getElementById(`comments-${postId}`);
    if (!commentsList) return;

    if (!comments || comments.length === 0) {
      commentsList.innerHTML = '<p class="no-comments">No comments yet.</p>';
      return;
    }

    // Fetch profiles for all comment authors
    const userIds = [...new Set(comments.map(c => c.user_id))];
    const profileMap = await fetchProfiles(userIds); // fetchProfiles must be defined

    // Build comment tree
    const commentMap = {};
    comments.forEach(comment => {
      commentMap[comment.id] = {
        ...comment,
        profile: profileMap[comment.user_id] || { username: 'Unknown', avatar_url: null },
        replies: [],
      };
    });

    const topLevelComments = [];
    for (const id in commentMap) {
      const c = commentMap[id];
      if (c.parent_id && commentMap[c.parent_id]) {
        commentMap[c.parent_id].replies.push(c);
      } else {
        topLevelComments.push(c);
      }
    }

    // Recursive render function
    function renderComment(comment, level = 0) {
      const marginLeft = level * 20;
      return `
        <div class="comment" style="margin-left: ${marginLeft}px">
          <a href="profile.html?userId=${comment.user_id}" class="comment-avatar-link">
            <img src="${comment.profile.avatar_url || '/assets/images/default-avatar.png'}" alt="" class="comment-avatar">
          </a>
          <div class="comment-body">
            <a href="profile.html?userId=${comment.user_id}" class="comment-author">${escapeHtml(comment.profile.username)}</a>
            <span class="comment-text">${escapeHtml(comment.text)}</span>
            <span class="comment-time">${formatTime(comment.created_at)}</span>
            <button class="reply-btn" data-comment-id="${comment.id}" data-post-id="${postId}">Reply</button>
          </div>
          <div class="reply-input-container" style="display: none;">
            <div class="reply-input-wrapper">
              <input type="text" class="reply-input" placeholder="Write a reply...">
              <button class="reply-submit">Post Reply</button>
            </div>
          </div>
        </div>
        ${comment.replies.map(reply => renderComment(reply, level + 1)).join('')}
      `;
    }

    commentsList.innerHTML = topLevelComments.map(c => renderComment(c, 0)).join('');

    // ----- Event delegation for reply actions -----
    commentsList.removeEventListener('click', handleCommentClicks);
    commentsList.addEventListener('click', handleCommentClicks);

    function handleCommentClicks(e) {
      // Reply button clicked
      const replyBtn = e.target.closest('.reply-btn');
      if (replyBtn) {
        e.preventDefault();
        const container = replyBtn.closest('.comment-body').nextElementSibling;
        if (container) {
          // Toggle display
          container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }
        return;
      }

      // Reply submit button clicked
      const submitBtn = e.target.closest('.reply-submit');
      if (submitBtn) {
        e.preventDefault();
        const container = submitBtn.closest('.reply-input-container');
        const input = container.querySelector('.reply-input');
        const text = input.value.trim();
        if (!text) return;
        const parentCommentId = container.closest('.comment').querySelector('.reply-btn')?.dataset.commentId;
        if (!parentCommentId) return;
        (async () => {
          try {
            await supabase.from('comments').insert({
              post_id: postId,
              user_id: currentUserId,
              text,
              parent_id: parentCommentId,
            });
            input.value = '';
            container.style.display = 'none';
            await loadComments(postId); // reload comments to show the new reply
            // Update comment count on the post
            const commentToggle = document.querySelector(`.post-card[data-post-id="${postId}"] .comment-toggle span`);
            if (commentToggle) {
              commentToggle.textContent = parseInt(commentToggle.textContent) + 1;
            }
          } catch (error) {
            showModal({ title: 'Error', message: error.message, confirmText: 'OK' });
          }
        })();
      }
    }
  } catch (error) {
    console.error('Failed to load comments:', error);
  }
}
  // ---------- Create a New Post ----------
  async function createPost(content, imageFile) {
    let imageUrl = null;
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `posts/${currentUserId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, imageFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
      imageUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: currentUserId,
        content,
        image_url: imageUrl,
      })
      .select('id, content, image_url, user_id, created_at')
      .single();
    if (error) throw error;
    return data;
  }

  // ---------- Event Listeners ----------
  elements.feedTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.feedTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFeed = tab.dataset.feed;
      page = 1;
      hasMore = true;
      elements.postsFeed.innerHTML = '';
      loadPosts(currentFeed, page);
    });
  });

  window.addEventListener('scroll', throttle(() => {
    if (loading || !hasMore) return;
    const scrollY = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollY > height - 200) {
      loadPosts(currentFeed, page + 1);
    }
  }, 200));

  // Image upload handling
  const fileInput = elements.postImageUpload;
  if (elements.uploadImageLabel && fileInput) {
    elements.uploadImageLabel.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showModal({ title: 'Invalid File', message: 'Please select an image file.', confirmText: 'OK' });
        fileInput.value = '';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showModal({ title: 'File Too Large', message: 'Image must be less than 10MB.', confirmText: 'OK' });
        fileInput.value = '';
        return;
      }

      selectedImageFile = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (elements.imagePreview) {
          elements.imagePreview.innerHTML = `<img src="${event.target.result}" alt="Preview"><button type="button" id="removeImageBtn">&times;</button>`;
          elements.imagePreview.style.display = 'block';
          const removeBtn = document.getElementById('removeImageBtn');
          if (removeBtn) {
            removeBtn.addEventListener('click', () => {
              selectedImageFile = null;
              fileInput.value = '';
              elements.imagePreview.style.display = 'none';
            });
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }

  elements.createPostBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentUserId) {
      await showModal({ title: 'Login Required', message: 'Please log in to create a post.', confirmText: 'OK' });
      return;
    }
    const content = elements.postInput.value.trim();
    if (!content && !selectedImageFile) {
      await showModal({ title: 'Empty Post', message: 'Please write something or select an image.', confirmText: 'OK' });
      return;
    }

    try {
      elements.createPostBtn.disabled = true;
      const newPost = await createPost(content, selectedImageFile);
      const profile = await getCurrentUserProfile();
      const postWithProfile = {
        ...newPost,
        profiles: {
          username: profile ? profile.username : 'Unknown',
          avatar_url: profile ? profile.avatar_url : null,
        },
        likes_count: 0,
        comments_count: 0,
        user_liked: false,
      };
      const postEl = createPostElement(postWithProfile);
      elements.postsFeed.prepend(postEl);
      elements.postInput.value = '';
      selectedImageFile = null;
      if (fileInput) fileInput.value = '';
      if (elements.imagePreview) elements.imagePreview.style.display = 'none';
    } catch (error) {
      console.error('Create post error:', error);
      await showModal({ title: 'Error', message: error.message || 'Failed to create post.', confirmText: 'OK' });
    } finally {
      elements.createPostBtn.disabled = false;
    }
  });

  elements.backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---------- Initialization ----------
  (async function init() {
    const user = await getCurrentUser();
    if (user) {
      // Ensure profile exists (already done in getCurrentUser)
      await getCurrentUserProfile();
    }
    await loadPosts(currentFeed, 1);
  })();
});
