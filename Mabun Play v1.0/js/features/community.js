// js/features/community.js
import { showModal } from '../utils/modal.js';
import { timeAgo } from '../utils/formatters.js';
import { throttle } from '../utils/helpers.js';

// DOM elements
const elements = {
  postInput: document.getElementById('postInput'),
  createPostBtn: document.getElementById('createPostBtn'),
  feedTabs: document.querySelectorAll('.feed-tab'),
  postsFeed: document.getElementById('postsFeed'),
  feedLoader: document.getElementById('feedLoader'),
  feedEnd: document.getElementById('feedEnd'),
  backToTopBtn: document.getElementById('backToTopBtn'),
  postImageUpload: document.getElementById('postImageUpload'),
  imagePreview: document.getElementById('imagePreview'),
};

let currentFeed = 'latest'; // 'latest', 'trending', 'following'
let page = 1;
let loading = false;
let hasMore = true;
let selectedImageFile = null;
let supabase = null;

// Utility
function waitForSupabase() {
  return new Promise((resolve) => {
    if (window.supabaseClient) resolve(window.supabaseClient);
    else {
      const interval = setInterval(() => {
        if (window.supabaseClient) {
          clearInterval(interval);
          resolve(window.supabaseClient);
        }
      }, 50);
    }
  });
}

// Load posts based on feed type
async function loadPosts(feed, pageNum = 1) {
  if (loading || !hasMore) return;
  loading = true;
  elements.feedLoader.style.display = 'block';

  try {
    const supabase = await waitForSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, avatar_url),
        likes:likes(count),
        comments:comments(count)
      `)
      .order('created_at', { ascending: false });

    // Apply filter
    if (feed === 'following' && user) {
      // Get users the current user follows
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const followingIds = following.map(f => f.following_id);
      if (followingIds.length) {
        query = query.in('user_id', followingIds);
      } else {
        // No following, return empty
        hasMore = false;
        elements.postsFeed.innerHTML = '<div class="empty-state">Follow people to see their posts</div>';
        return;
      }
    }

    const { data: posts, error } = await query.range((pageNum - 1) * 10, pageNum * 10 - 1);
    if (error) throw error;

    // For trending, sort by (likes + comments) in the last 24h
    let processedPosts = posts || [];
    if (feed === 'trending') {
      processedPosts = processedPosts.sort((a, b) => {
        const aScore = (a.likes?.[0]?.count || 0) + (a.comments?.[0]?.count || 0);
        const bScore = (b.likes?.[0]?.count || 0) + (b.comments?.[0]?.count || 0);
        return bScore - aScore;
      });
    }

    hasMore = posts.length === 10;
    page = pageNum;

    if (processedPosts.length === 0 && pageNum === 1) {
      elements.postsFeed.innerHTML = '<div class="empty-state">No posts yet. Be the first!</div>';
    } else {
      for (const post of processedPosts) {
        const postEl = await createPostElement(post);
        elements.postsFeed.appendChild(postEl);
      }
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

// Create a post element
async function createPostElement(post) {
  const supabase = await waitForSupabase();
  const authorName = post.profiles?.username || 'Unknown';
  const authorAvatar = post.profiles?.avatar_url || '/assets/images/default-avatar.png';
  const createdAt = post.created_at;
  const likeCount = post.likes?.[0]?.count || 0;
  const commentCount = post.comments?.[0]?.count || 0;

  const div = document.createElement('div');
  div.className = 'post-card';
  div.dataset.postId = post.id;

  // Build HTML structure
  div.innerHTML = `
    <div class="post-header">
      <img src="${authorAvatar}" alt="" class="post-avatar" data-user-id="${post.user_id}">
      <div class="post-meta">
        <span class="post-author" data-user-id="${post.user_id}">${authorName}</span>
        <span class="post-time">${timeAgo(createdAt)}</span>
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

  // Avatar click -> profile page
  const avatars = div.querySelectorAll('.post-avatar, .post-author');
  avatars.forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `profile.html?userId=${post.user_id}`;
    });
  });

  // Like button
  const likeBtn = div.querySelector('.like-btn');
  likeBtn.addEventListener('click', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showModal({ title: 'Login Required', message: 'Please log in to like posts.', confirmText: 'OK' });
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

      // Update count (re-fetch from server)
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

  // Comment submission
  const commentInput = div.querySelector('.comment-input');
  const commentSubmit = div.querySelector('.comment-submit');
  commentSubmit.addEventListener('click', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showModal({ title: 'Login Required', message: 'Please log in to comment.', confirmText: 'OK' });
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

// Load comments for a post (including replies)
async function loadComments(postId) {
  const supabase = await waitForSupabase();
  try {
    // Fetch top-level comments (parent_comment_id IS NULL) and replies separately
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (username, avatar_url),
        replies:comments!parent_comment_id (*, profiles:user_id (username, avatar_url))
      `)
      .eq('post_id', postId)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const commentsList = document.getElementById(`comments-${postId}`);
    if (!commentsList) return;
    if (!comments || comments.length === 0) {
      commentsList.innerHTML = '<p class="no-comments">No comments yet.</p>';
    } else {
      commentsList.innerHTML = comments.map(c => {
        const repliesHtml = c.replies?.map(r => `
          <div class="comment reply">
            <img src="${r.profiles?.avatar_url || '/assets/images/default-avatar.png'}" alt="" class="comment-avatar">
            <div class="comment-body">
              <span class="comment-author">${r.profiles?.username || 'Unknown'}</span>
              <span class="comment-text">${r.text}</span>
              <span class="comment-time">${timeAgo(r.created_at)}</span>
            </div>
          </div>
        `).join('') || '';

        return `
          <div class="comment">
            <img src="${c.profiles?.avatar_url || '/assets/images/default-avatar.png'}" alt="" class="comment-avatar">
            <div class="comment-body">
              <span class="comment-author">${c.profiles?.username || 'Unknown'}</span>
              <span class="comment-text">${c.text}</span>
              <span class="comment-time">${timeAgo(c.created_at)}</span>
              <button class="reply-btn" data-comment-id="${c.id}">Reply</button>
              <div class="reply-form" style="display: none;">
                <input type="text" class="reply-input" placeholder="Write a reply...">
                <button class="reply-submit">Post</button>
              </div>
              <div class="replies-list">
                ${repliesHtml}
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Attach reply handlers
      document.querySelectorAll(`#comments-${postId} .reply-btn`).forEach(btn => {
        btn.addEventListener('click', (e) => {
          const replyForm = btn.nextElementSibling;
          replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
        });
      });
      document.querySelectorAll(`#comments-${postId} .reply-submit`).forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const replyForm = btn.parentElement;
          const input = replyForm.querySelector('.reply-input');
          const text = input.value.trim();
          if (!text) return;
          const commentId = replyForm.parentElement.querySelector('.reply-btn').dataset.commentId;
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            showModal({ title: 'Login Required', message: 'Please log in to reply.', confirmText: 'OK' });
            return;
          }
          try {
            await supabase.from('comments').insert({
              post_id: postId,
              user_id: user.id,
              text,
              parent_comment_id: commentId,
            });
            input.value = '';
            replyForm.style.display = 'none';
            await loadComments(postId); // reload to show new reply
          } catch (error) {
            console.error('Reply failed:', error);
          }
        });
      });
    }
  } catch (error) {
    console.error('Failed to load comments:', error);
  }
}

// Create a new post
async function createPost(content, imageFile) {
  const supabase = await waitForSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let imageUrl = null;
  if (imageFile) {
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
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
      profiles:user_id (id, username, avatar_url),
      likes:likes(count),
      comments:comments(count)
    `)
    .single();
  if (error) throw error;
  return data;
}

// Initialize event listeners
async function init() {
  const supabase = await waitForSupabase();
  if (!supabase) {
    console.error('Supabase client not available');
    return;
  }

  // Load initial feed
  await loadPosts(currentFeed, 1);

  // Tab switching
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

  // Infinite scroll
  window.addEventListener('scroll', throttle(async () => {
    if (loading || !hasMore) return;
    const scrollY = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollY > height - 200) {
      await loadPosts(currentFeed, page + 1);
    }
  }, 200));

  // Image upload preview
  const fileInput = elements.postImageUpload;
  if (fileInput) {
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

  // Create post
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
      const postEl = await createPostElement(newPost);
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

  // Back to top button
  if (elements.backToTopBtn) {
    elements.backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
