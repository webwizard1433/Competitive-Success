const modal = document.getElementById('videoModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoGrid = document.getElementById('videoGrid');
let currentExamKey = 'upsc'; // Default exam

// --- Automatically determine the current exam from the URL or title ---
const path = window.location.pathname.toLowerCase();
if (path.includes('ssc-cgl')) currentExamKey = 'ssc-cgl';
else if (path.includes('cds')) currentExamKey = 'cds';
else if (path.includes('nda')) currentExamKey = 'nda';
else if (path.includes('banking')) currentExamKey = 'banking';
else if (path.includes('railways')) currentExamKey = 'railways';

let userData = { progress: {}, favorites: {} };
let currentVideoIndex = -1; // To track the current video in the modal
let upNextTimer; // For autoplay countdown
let player; // For YouTube Iframe API
let progressInterval; // For custom progress bar
let videoProgressData = {}; // For card progress bars

// --- User Data Management ---
const safeStorage = (() => {
    try {
        const storage = window.localStorage;
        storage.setItem('__test__', '1'); storage.removeItem('__test__'); return storage;
    } catch (e) {
        const memoryStore = {};
        return { setItem: (k, v) => { memoryStore[k] = v; }, getItem: (k) => memoryStore[k] || null, removeItem: (k) => { delete memoryStore[k]; } };
    }
})();
const userId = safeStorage.getItem('sessionToken');

// --- Lazy Loading with Intersection Observer ---
const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.onload = () => {
                img.style.opacity = 1;
                img.parentElement.classList.remove('loading');
            };
            img.onerror = () => {
                img.onerror = null;
                img.parentElement.classList.remove('loading');
                img.src = 'https://via.placeholder.com/320x180.png?text=Video+Not+Found';
                img.style.opacity = 1;
            };
            observer.unobserve(img);
        }
    });
}, { rootMargin: "0px 0px 200px 0px" }); // Start loading images 200px before they enter the viewport

// --- Video Progress Tracking (Session) ---
function loadVideoProgress() {
    const data = sessionStorage.getItem('videoProgress');
    videoProgressData = data ? JSON.parse(data) : {};
}


// --- Core Functions ---

async function fetchUserData() {
    if (!userId) return;
    // Using npoint.io as the data source
    try {
        const response = await fetch('https://api.npoint.io/628bf2833503e69fb337');
        if (!response.ok) {
            console.error("Failed to fetch user data from npoint");
            return;
        }
        const users = await response.json();
        const currentUser = users.find(u => u.contactInfo === userId);
        if (currentUser) {
            // Ensure progress and favorites properties exist
            // The top-level object will now hold exam-specific data
            userData = {
                ...currentUser, // Copy existing user data
                progress: currentUser.progress || {}, // Ensure progress object exists
                favorites: currentUser.favorites || {} // Ensure favorites object exists
            };
        }
    } catch (error) {
        console.error("Could not fetch user data", error);
    }
}

// --- Video Search/Filter ---
function filterVideos() {
    const searchInput = document.getElementById('videoSearchInput');
    if (!searchInput) return;

    const filter = searchInput.value.toLowerCase();
    const cards = document.querySelectorAll('.grid-container .resource-card');

    cards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        if (title.includes(filter)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}


// Function to create and append video cards
function populateVideos(videoData, defaultThumbnails, targetGrid = null) {
    const grid = targetGrid || document.getElementById('videoGrid');
    videoData.forEach((video, index) => {
        const card = document.createElement('div');
        card.className = 'resource-card';
        
        let thumbnailHtml = '';
        const isYouTube = video.id && !video.id.startsWith('placeholder_') && video.type !== 'gdrive';
        const defaultThumb = defaultThumbnails.placeholder || defaultThumbnails.default || 'https://via.placeholder.com/320x180.png?text=Video';
        
        if (isYouTube) {
            // Use <picture> for WebP optimization for YouTube videos
            thumbnailHtml = `
                <picture>
                    <source srcset="https://img.youtube.com/vi_webp/${video.id}/maxresdefault.webp" type="image/webp">
                    <img data-src="https://img.youtube.com/vi/${video.id}/maxresdefault.jpg" alt="${video.title}">
                </picture>
            `;
        } else {
            const thumbUrl = video.type === 'gdrive' ? defaultThumbnails.gdrive : defaultThumb;
            thumbnailHtml = `<img data-src="${thumbUrl}" alt="${video.title}">`;
        }

        card.innerHTML = `
            <div class="card-thumbnail loading">
                ${thumbnailHtml}
                <span class="play-icon">▶</span>
            </div>
            <div class="card-content"> 
                <h3>${video.title}</h3>
                <div class="card-controls">
                    <div class="control-item">
                        <input type="checkbox" id="progress-${video.id}" class="progress-checkbox" ${isCompleted(video.id) ? 'checked' : ''}>
                        <label for="progress-${video.id}">Completed</label>
                    </div>
                    <div class="control-item">
                        <button class="favorite-btn ${isFavorited(video.id) ? 'favorited' : ''}" title="Add to favorites">
                            ⭐
                        </button>
                    </div>
                </div>
            </div>
            <div class="card-progress-bar-container">
                <div class="card-progress-bar" id="progress-bar-${video.id}"></div>
            </div>
        `;
        if (video.id.startsWith('placeholder_')) {
            card.classList.add('placeholder');
        } else {
            card.onclick = () => openModal(video);
            card.setAttribute('tabindex', '0'); // Make it focusable
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    openModal(video);
                }
            });
        }

        grid.appendChild(card);

        // Observe the image for lazy loading
        const img = card.querySelector('img');
        lazyLoadObserver.observe(img);

        // Set initial progress bar width
        const progressBar = card.querySelector(`#progress-bar-${video.id}`);
        if (progressBar && videoProgressData[video.id]) {
            progressBar.style.width = `${videoProgressData[video.id]}%`;
        }

        // --- Event Listeners for Controls ---
        const favoriteBtn = card.querySelector('.favorite-btn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the card's click event from firing
                card.classList.add('animate-zoom');
                handleFavoriteUpdate(video, favoriteBtn);
                card.addEventListener('animationend', () => card.classList.remove('animate-zoom'), { once: true });
            });
        }

        const progressCheckbox = card.querySelector('.progress-checkbox');
        if (progressCheckbox) {
            progressCheckbox.addEventListener('change', () => {
                card.classList.add('animate-zoom');
                card.addEventListener('animationend', () => card.classList.remove('animate-zoom'), { once: true });
            });
            progressCheckbox.addEventListener('click', (e) => e.stopPropagation()); // Prevent card click
            progressCheckbox.addEventListener('change', (e) => handleProgressUpdate(video.id, e.target.checked));
        }
    });
}

function isFavorited(videoId) {
    // Check within the current exam's favorites
    return userData.favorites && userData.favorites[currentExamKey] && userData.favorites[currentExamKey].some(fav => fav.id === videoId);
}

function isCompleted(videoId) {
    // Check within the current exam's progress
    return userData.progress && userData.progress[currentExamKey] && userData.progress[currentExamKey][videoId];
}

async function handleProgressUpdate(videoId, isCompleted) {
    if (!userId) return;

    // --- Immediate UI and Local Data Update ---
    // Ensure the exam-specific progress object exists
    if (!userData.progress[currentExamKey]) userData.progress[currentExamKey] = {};

    if (isCompleted) {
        userData.progress[currentExamKey][videoId] = true;
    } else {
        delete userData.progress[currentExamKey][videoId];
    }

    const npointUrl = 'https://api.npoint.io/628bf2833503e69fb337';
    try {
        // 1. Get the current list of users
        const getResponse = await fetch(npointUrl);
        let users = await getResponse.json();

        // 2. Find and update the current user's progress
        const userIndex = users.findIndex(u => u.contactInfo === userId);
        if (userIndex > -1) {
            // Overwrite the entire progress object with the updated local one
            users[userIndex].progress = userData.progress;
        }

        // 3. Post the entire updated list back
        await fetch(npointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(users)
        });
    } catch (error) {
        console.error("Failed to update progress:", error);
    }
}

async function handleFavoriteUpdate(video, button) {
    if (!userId) return;
    const npointUrl = 'https://api.npoint.io/628bf2833503e69fb337';

    // --- Immediate UI and Local Data Update ---
    // Ensure the exam-specific favorites array exists
    if (!userData.favorites[currentExamKey]) userData.favorites[currentExamKey] = [];

    const isCurrentlyFavorited = userData.favorites[currentExamKey].some(v => v.id === video.id);
    if (!isCurrentlyFavorited) {
        userData.favorites[currentExamKey].push(video);
    } else {
        userData.favorites[currentExamKey] = userData.favorites[currentExamKey].filter(v => v.id !== video.id);
    }
    button.classList.toggle('favorited', !isCurrentlyFavorited);

    try {
        // 1. Get the current list of users
        const getResponse = await fetch(npointUrl);
        let users = await getResponse.json();

        // 2. Find and update the current user's favorites
        const userIndex = users.findIndex(u => u.contactInfo === userId);
        if (userIndex > -1) {
            // Overwrite the entire favorites array with the updated local one
            users[userIndex].favorites = userData.favorites;
        }

        // 3. Post the entire updated list back
        const postResponse = await fetch(npointUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(users) });
        if (!postResponse.ok) throw new Error('Failed to save favorite status.');
    } catch (error) {
        console.error("Failed to update favorites:", error);
    }
}

function navigateVideo(direction) {
    const newIndex = currentVideoIndex + direction;

    // Ensure the new index is within the bounds of the videoData array
    if (newIndex >= 0 && newIndex < videoData.length) {
        const nextVideo = videoData[newIndex];
        openModal(nextVideo);
    }
}

function updateNavButtons() {
    const prevBtn = document.getElementById('prevVideoBtn');
    const nextBtn = document.getElementById('nextVideoBtn');
    if (!prevBtn || !nextBtn) return;

    // Disable 'Previous' if it's the first video
    prevBtn.style.display = currentVideoIndex > 0 ? 'block' : 'none';
    // Disable 'Next' if it's the last video
    nextBtn.style.display = currentVideoIndex < videoData.length - 1 ? 'block' : 'none';
}

// Function to open the modal and play the video
function openModal(video) {
    if (!video || !video.id || video.id.startsWith('placeholder_')) return;

    // Clear any existing autoplay timer
    clearTimeout(upNextTimer);
    document.getElementById('upNextCountdown').style.display = 'none';

    let embedUrl = '';

    if (video.type === 'gdrive') {
        embedUrl = `https://drive.google.com/file/d/${video.id}/preview`;
        videoPlayer.src = embedUrl;
        // Hide YouTube-specific controls for GDrive
        document.getElementById('customControls').style.display = 'none';
        document.getElementById('youtubeControls').style.display = 'none';
        videoPlayer.parentElement.classList.remove('hide-yt-controls');
    } else { // Default to YouTube
        // Use YouTube Iframe API
        embedUrl = `https://www.youtube.com/embed/${video.id}?autoplay=1&enablejsapi=1&origin=${window.location.origin}&controls=0&rel=0&modestbranding=1`;
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(video.id);
        } else {
            videoPlayer.src = embedUrl;
        }
        document.getElementById('customControls').style.display = 'flex';
        document.getElementById('youtubeControls').style.display = 'flex';
    }

    modal.classList.add('show');

    // Set the active video title
    const videoTitleEl = document.getElementById('videoTitle');
    if (videoTitleEl) {
        videoTitleEl.textContent = video.title;
    }

    // Reset playback speed display
    const playbackSpeedDisplay = document.getElementById('playbackSpeed');
    if (playbackSpeedDisplay) {
        playbackSpeedDisplay.textContent = '1x';
    }
    // Reset player speed if it exists
    if (player && typeof player.setPlaybackRate === 'function') {
        player.setPlaybackRate(1);
    }

    // Add a class to body to prevent background scrolling
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleModalKeydown);

    currentVideoIndex = videoData.findIndex(v => v.id === video.id);
    updateNavButtons();

    loadDoubtForum(video.id);
    // Store the currently playing video ID in session storage
    try {
        // Store only the necessary info to prevent errors on page reload.
        // The full video object was causing parsing issues on other pages.
        const videoToStore = {
            id: video.id,
            title: video.title,
            type: video.type
        };
        sessionStorage.setItem('activeVideo', JSON.stringify(videoToStore));
    } catch(e) {
        console.error("Could not update recently watched list:", e);
    }
}

function closeModal() {
    modal.classList.remove('show');
    videoPlayer.src = "";
    currentVideoIndex = -1; // Reset index when modal is closed
    document.body.classList.remove('modal-open'); // Allow background scrolling again
    document.removeEventListener('keydown', handleModalKeydown);
    clearInterval(progressInterval); // Stop progress bar updates
    clearTimeout(upNextTimer); // Clear autoplay timer on manual close
    // Stop the YouTube video
    if (player && typeof player.stopVideo === 'function') {
        player.stopVideo();
    }
}

function toggleFocusMode() {
    const modal = document.getElementById('videoModal');
    const btn = document.getElementById('focusModeBtn');
    modal.classList.toggle('focus-active');

    if (modal.classList.contains('focus-active')) {
        btn.textContent = 'Exit Focus';
    } else {
        btn.textContent = 'Focus Mode';
    }
}

// --- YouTube Iframe API Functions ---
function onYouTubeIframeAPIReady() {
    player = new YT.Player('videoPlayer', {
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    // Setup custom controls
    const playPauseBtn = document.getElementById('playPauseBtn');
    const progressBarWrapper = document.getElementById('progressBarWrapper');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    playPauseBtn.onclick = () => togglePlayPause();
    fullscreenBtn.onclick = () => toggleFullscreen();
    progressBarWrapper.onclick = (e) => {
        const rect = progressBarWrapper.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const seekTo = (clickX / width) * player.getDuration();
        player.seekTo(seekTo, true);
    };
}

function onPlayerStateChange(event) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    clearInterval(progressInterval);

    if (event.data === YT.PlayerState.PLAYING) {
        playPauseBtn.textContent = '⏸️';
        videoPlayer.parentElement.classList.add('hide-yt-controls');
        progressInterval = setInterval(updateProgressBar, 250);
    } else {
        playPauseBtn.textContent = '▶️';
        videoPlayer.parentElement.classList.remove('hide-yt-controls');
    }

    // When video ends (state 0), start the 'Up Next' countdown and show controls
    if (event.data === YT.PlayerState.ENDED) {
        videoPlayer.parentElement.classList.remove('hide-yt-controls');
        const nextIndex = currentVideoIndex + 1;
        if (nextIndex < videoData.length) {
            const countdownEl = document.getElementById('upNextCountdown');
            const upNextTitleEl = document.getElementById('upNextTitle');
            const countdownTimerEl = document.getElementById('countdownTimer');

            upNextTitleEl.textContent = `Up Next: ${videoData[nextIndex].title}`;
            countdownEl.style.display = 'flex';

            let countdown = 5;
            countdownTimerEl.textContent = countdown;

            upNextTimer = setInterval(() => {
                countdown--;
                countdownTimerEl.textContent = countdown;
                if (countdown <= 0) {
                    clearInterval(upNextTimer);
                    navigateVideo(1); // Autoplay next video
                }
            }, 1000);
        }
    }
}

// --- Custom Player Control Functions ---
function togglePlayPause() {
    if (!player || typeof player.getPlayerState !== 'function') return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function toggleFullscreen() {
    const iframe = document.getElementById('videoPlayer');
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        iframe.requestFullscreen();
    }
}

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${String(sec).padStart(2, '0')}`;
}

function updateProgressBar() {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();
    const progress = (currentTime / duration) * 100;

    document.getElementById('progressBar').style.width = `${progress}%`;

    // Update card progress bar
    const currentVideoId = videoData[currentVideoIndex]?.id;
    if (currentVideoId) {
        const cardProgressBar = document.getElementById(`progress-bar-${currentVideoId}`);
        if (cardProgressBar) cardProgressBar.style.width = `${progress}%`;
        videoProgressData[currentVideoId] = progress;
        sessionStorage.setItem('videoProgress', JSON.stringify(videoProgressData));
    }

    document.getElementById('currentTime').textContent = formatTime(currentTime);
    document.getElementById('duration').textContent = formatTime(duration);
}

// --- Keyboard Navigation for Modal ---
function handleModalKeydown(e) {
    if (e.key === 'Escape') {
        closeModal();
    } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); // Prevent page scroll
        togglePlayPause();
    } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
    }
}

function changePlaybackSpeed(rate) {
    if (player && typeof player.setPlaybackRate === 'function') {
        player.setPlaybackRate(rate);
        document.getElementById('playbackSpeed').textContent = `${rate}x`;
    }
}

function togglePictureInPicture() {
    if (document.pictureInPictureEnabled && videoPlayer.src.includes('youtube')) {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
        } else {
            // The YouTube Iframe API doesn't directly support PiP request.
            // We have to request it on the underlying video element if possible,
            // but browser security often prevents this for cross-origin iframes.
            // This is a known limitation. We add a message for the user.
            alert("To use Picture-in-Picture, right-click twice on the video and select 'Picture in picture'.");
        }
    } else {
        alert('Picture-in-Picture is not supported for this video or by your browser.');
    }
}

// --- Doubt Forum Logic ---
async function loadDoubtForum(videoId) {
    const forumContainer = document.getElementById('doubtForum');
    if (!forumContainer) return;

    // --- Create Tab Structure ---
    forumContainer.innerHTML = `
        <div class="video-extra-tabs">
            <div class="video-tab-link active" onclick="showVideoTab('doubts')">Doubts & Discussions</div>
            <div class="video-tab-link" onclick="showVideoTab('transcript')">Transcript</div>
        </div>
        <div id="doubtsContent" class="video-tab-content active">
            <form id="doubtForm" class="doubt-form">
                <textarea id="doubtQuestion" placeholder="Have a question about this video? Ask here..." required></textarea>
                <button type="submit" class="btn">Post Question</button>
            </form>
            <div id="doubtList" class="doubt-list"></div>
        </div>
        <div id="transcriptContent" class="video-tab-content">
            <p>Video transcript is not available for this lecture yet. Please check back later.</p>
            <!-- In a real app, you would fetch and display the transcript here -->
        </div>
    `;

    document.getElementById('doubtForm').addEventListener('submit', (e) => {
        e.preventDefault();
        postDoubt(videoId);
    });

    // Fetch and display existing doubts
    try {
        const response = await fetch(`/api/doubts?videoId=${videoId}`);
        const doubts = await response.json();
        const doubtList = document.getElementById('doubtList');
        doubtList.innerHTML = ''; // Clear previous doubts
        if (doubts.length === 0) {
            doubtList.innerHTML = '<p>No questions have been asked for this video yet. Be the first!</p>';
        } else {
            doubts.forEach(doubt => {
                const doubtEl = document.createElement('div');
                doubtEl.className = 'doubt-item';
                doubtEl.innerHTML = `
                    <div class="doubt-header">
                        <span class="author">${doubt.userName}</span>
                        <span class="date">${new Date(doubt.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p class="doubt-question">${doubt.question}</p>
                    <div class="replies-container">
                        ${doubt.replies.map(reply => `
                            <div class="reply-item">
                                <div class="doubt-header" style="margin-bottom: 0.5rem;">
                                    <span class="author">${reply.userName}</span>
                                    <span class="date">${new Date(reply.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p>${reply.reply}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
                doubtList.appendChild(doubtEl);
            });
        }
    } catch (error) {
        console.error('Failed to load doubts:', error);
    }
}

function showVideoTab(tabName) {
    document.querySelectorAll('.video-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.video-tab-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(`${tabName}Content`).classList.add('active');
    document.querySelector(`.video-tab-link[onclick="showVideoTab('${tabName}')"]`).classList.add('active');
}

async function postDoubt(videoId) {
    const question = document.getElementById('doubtQuestion').value;
    const userName = safeStorage.getItem('userName');
    if (!question.trim() || !userName) return;

    await fetch('/api/doubts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, question, userName, userId })
    });

    // Refresh the forum
    document.getElementById('doubtQuestion').value = '';
    loadDoubtForum(videoId);
}

// Close the modal if the user clicks outside of the video content
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}

// --- Back to Top Button Logic ---
const backToTopBtn = document.getElementById('backToTopBtn');
if (backToTopBtn) {
    window.onscroll = function() {
        if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
            backToTopBtn.style.display = "block";
        } else {
            backToTopBtn.style.display = "none";
        }
    };
    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    backToTopBtn.onclick = scrollToTop;
}

// --- Add Navigation Buttons to Modal on Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Load video progress from session storage at the start
    loadVideoProgress();

    if (modal) {
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.insertAdjacentHTML('beforeend', '<button id="prevVideoBtn" class="modal-nav prev" onclick="navigateVideo(-1)">&#10094;</button>');
            modalContent.insertAdjacentHTML('beforeend', '<button id="focusModeBtn" class="focus-mode-btn" onclick="toggleFocusMode()">Focus Mode</button>');
            modalContent.insertAdjacentHTML('beforeend', '<button id="nextVideoBtn" class="modal-nav next" onclick="navigateVideo(1)">&#10095;</button>');
        }

        // Load YouTube Iframe API script
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
});