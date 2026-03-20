import { supabase } from '../core/supabase.js';
import { showModal } from '../utils/modal.js';
import { throttle } from '../utils/helpers.js';

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
    removeImageBtn: document.getElementById('removeImageBtn')
  };

  let currentFeed = 'latest';
  let page = 1;
  let loading = false;
  let hasMore = true;
  let selectedImageFile = null;

  async function loadPosts(feed, pageNum) {
    if (loading || !hasMore) return;
    loading = true;
    elements.feedLoader.style.display = 'block';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          likes:likes(count),
          comments:comments(count)
        `)
        .order('created_at', { ascending: false });

      if (feed === 'following' && user) {
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        const followingIds = following.map(f => f.following_id);
        if (followingIds.length) {
          query = query.in('user_id', followingIds);
        } else {
          query = query.eq('user_id', '00000000-0000-0000-0000-000000000000'); // no results
        }
      }

      const { data, error } = await query.range((pageNum - 1) * 20, pageNum * 20 - 1);
      if (error) throw error;

      const posts = data || [];
      hasMore = posts.length === 20;
      page = pageNum;

      if (posts.length === 0 && pageNum === 1) {
        elements.postsFeed.innerHTML = '<div class="empty-state">No posts yet. Be the first!</div>';
      } else {
        posts.forEach(post => {
          elements.postsFeed.appendChild(createPostElement(post));
        });
      }

      elements.feedEnd.style.display = hasMore ? 'none' : 'block';
    } catch (error) {
      console.error('Failed to load feed:', error);
      showModal({ title: 'Error', message: 'Failed to load feed.', confirmText: 'OK' });
    } finally {
      loading = false;
      elements.feedLoader.style.display = 'none';
    }
  }

  function createPostElement(post) {
    const authorName = post.profiles?.username || 'Unknown';
    const authorAvatar = post.profiles?.avatar_url || '/assets/images/default-avatar.png';
    const createdAt = post.created_at;
    const likeCount = post.likes?.[0]?.count || 0;
    const commentCount = post.comments?.[0]?.count || 0;

    const div = document.createElement('div');
    div.className = 'post-card';
    div.dataset.postId = post.id;
    div.innerHTML = `
      <div class="post-header">
        <img src="${authorAvatar}" alt="" class="post-avatar">
        <div class="post-meta">
          <span class="post-author">${authorName}</span>
          <span class="post-time">${formatTime(createdAt)}</span>
        </div>
      </div>
      <div class="post-content">${post.content || ''}</div>
      ${post.image_url ? `<img src="${post.image_url}" alt="" class="post-image">` : ''}
      <div class="post-actions">
        <button class="post-action like-btn" data-id="${post.id}">
          <iconify-icon icon="solar:heart-linear"></iconify-icon>
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

    const likeBtn = div.querySelector('.like-btn');
    likeBtn.addEventListener('click', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        await showModal({ title: 'Login Required', message: 'Please log in to like posts.', confirmText: 'OK' });
        return;
      }
      try {
        const { data: existing } = await supabase
          .from('likes')
          .select('*')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .single();

        if (existing) {
          await supabase.from('likes').delete().eq('id', existing.id);
        } else {
          await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
        }

        const { count } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);
        likeBtn.querySelector('span').textContent = count;
        const icon = likeBtn.querySelector('iconify-icon');
        icon.setAttribute('icon', existing ? 'solar:heart-linear' : 'solar:heart-bold');
      } catch (error) {
        console.error('Like failed:', error);
      }
    });

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

    const commentInput = div.querySelector('.comment-input');
    const commentSubmit = div.querySelector('.comment-submit');
    commentSubmit.addEventListener('click', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        await showModal({ title: 'Login Required', message: 'Please log in to comment.', confirmText: 'OK' });
        return;
      }
      const text = commentInput.value.trim();
      if (!text) return;
      try {
        await supabase.from('comments').insert({
          post_id: post.id,
          user_id: user.id,
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

  async function loadComments(postId) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const commentsList = document.getElementById(`comments-${postId}`);
      if (!commentsList) return;
      if (!data || data.length === 0) {
        commentsList.innerHTML = '<p class="no-comments">No comments yet.</p>';
      } else {
        commentsList.innerHTML = data.map(c => `
          <div class="comment">
            <img src="${c.profiles?.avatar_url || '/assets/images/default-avatar.png'}" alt="" class="comment-avatar">
            <div class="comment-body">
              <span class="comment-author">${c.profiles?.username || 'Unknown'}</span>
              <span class="comment-text">${c.text}</span>
              <span class="comment-time">${formatTime(c.created_at)}</span>
            </div>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  }

  async function createPost(content, imageFile) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      await showModal({ title: 'Login Required', message: 'Please log in to create a post.', confirmText: 'OK' });
      return null;
    }

    let imageUrl = null;
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `posts/${user.id}/${Date.now()}.${fileExt}`;
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
        user_id: user.id,
        content,
        image_url: imageUrl,
      })
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .single();
    if (error) throw error;
    return data;
  }

  // Event listeners
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
    const content = elements.postInput.value.trim();
    if (!content && !selectedImageFile) {
      await showModal({ title: 'Empty Post', message: 'Please write something or select an image.', confirmText: 'OK' });
      return;
    }

    try {
      elements.createPostBtn.disabled = true;
      const newPost = await createPost(content, selectedImageFile);
      if (newPost) {
        const postEl = createPostElement(newPost);
        elements.postsFeed.prepend(postEl);
        elements.postInput.value = '';
        selectedImageFile = null;
        if (fileInput) fileInput.value = '';
        if (elements.imagePreview) elements.imagePreview.style.display = 'none';
      }
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

  loadPosts(currentFeed, 1);
});