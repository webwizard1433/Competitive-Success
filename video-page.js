const modal = document.getElementById('videoModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoPlayerContainer = document.getElementById('videoPlayerContainer');
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
        card.dataset.index = index; // Store the video's index on the card
        
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
            card.onclick = () => openModal(null, parseInt(card.dataset.index));
            card.setAttribute('tabindex', '0');
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    openModal(video, parseInt(card.dataset.index));
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
function openModal(video, index = -1) {
    // If an index is provided, get the video from the global videoData array
    // This is crucial for pages with multiple grids.
    if (index !== -1 && !video) video = videoData[index];

    if (!video || !video.id || video.id.startsWith('placeholder_')) return;

    // Clear any existing autoplay timer
    clearTimeout(upNextTimer);
    document.getElementById('upNextCountdown').style.display = 'none';

    let embedUrl = '';

    // Reset player container classes
    videoPlayerContainer.className = 'video-container';

    if (video.type === 'gdrive') {
        embedUrl = `https://drive.google.com/file/d/${video.id}/preview`;
    } else { // Default to YouTube
        // Use YouTube Iframe API
        videoPlayerContainer.classList.add('modern'); // Use new modern player
        embedUrl = `https://www.youtube.com/embed/${video.id}?autoplay=1&enablejsapi=1&origin=${window.location.origin}&controls=0&rel=0&modestbranding=1`;
    }

    // Load the video
    if (player && typeof player.loadVideoById === 'function' && video.type !== 'gdrive' && player.getIframe().src.includes(video.id)) {
        // If player exists and it's the same video, just play it
        player.playVideo();
    } else if (player && typeof player.loadVideoById === 'function' && video.type !== 'gdrive') {
        player.loadVideoById(video.id);
    } else {
        videoPlayer.src = embedUrl;
    }

    modal.classList.add('show');

    // Set the active video title
    document.getElementById('videoTitle').textContent = video.title;

    // Reset time display
    document.getElementById('currentTime').textContent = '0:00';
    document.getElementById('duration').textContent = '0:00';

    // Reset and populate settings menu
    populateSettingsMenu();
    changePlaybackSpeed(1, true); // Reset to 1x speed

    // Add a class to body to prevent background scrolling
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleModalKeydown);

    currentVideoIndex = videoData.findIndex(v => v.id === video.id);
    updateNavButtons();

    // loadDoubtForum(video.id); // Temporarily disabled as per request
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
    const bigPlayBtn = document.getElementById('bigPlayBtn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const progressBarWrapper = document.getElementById('progressBarWrapper');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const pipBtn = document.getElementById('pipBtn');
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeSlider = document.getElementById('volumeSlider');

    if (bigPlayBtn) bigPlayBtn.onclick = () => togglePlayPause();
    if (playPauseBtn) playPauseBtn.onclick = () => togglePlayPause();
    fullscreenBtn.onclick = () => toggleFullscreen();
    pipBtn.onclick = () => togglePictureInPicture();

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            document.getElementById('settingsMenu').classList.toggle('active');
        };
    }

    progressBarWrapper.onclick = (e) => {
        const rect = progressBarWrapper.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const seekTo = (clickX / width) * player.getDuration();
        player.seekTo(seekTo, true);
    };

    // Volume controls
    volumeBtn.onclick = () => toggleMute();
    volumeSlider.addEventListener('input', e => {
        player.setVolume(e.target.value * 100);
        player.unMute();
    });

    // Hide settings menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsBtn.contains(e.target) && !document.getElementById('settingsMenu').contains(e.target)) {
            document.getElementById('settingsMenu').classList.remove('active');
        }
    });
}

function onPlayerStateChange(event) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    clearInterval(progressInterval);

    if (event.data === YT.PlayerState.PLAYING) {
        videoPlayerContainer.classList.remove('paused');
        playPauseBtn.innerHTML = `<svg viewBox="0 0 320 512"><path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/></svg>`; // Pause Icon
        playPauseBtn.setAttribute('data-tooltip', 'Pause');
        progressInterval = setInterval(updateProgressBar, 250);
    } else {
        videoPlayerContainer.classList.add('paused');
        playPauseBtn.innerHTML = `<svg viewBox="0 0 384 512"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>`; // Play Icon
        playPauseBtn.setAttribute('data-tooltip', 'Play');
    }

}

function toggleMute() {
    if (!player || typeof player.isMuted !== 'function') return;
    const volumeBtn = document.getElementById('volumeBtn');
    if (player.isMuted()) {
        player.unMute();
        volumeBtn.setAttribute('data-tooltip', 'Mute');
        volumeBtn.innerHTML = `<svg viewBox="0 0 640 512"><path d="M533.6 32.5C598.5 85.3 640 165.8 640 256s-41.5 170.8-106.4 223.5c-10.1 8.4-25.3 6.9-33.8-3.2s-6.9-25.3 3.2-33.8C557.5 398.2 592 331.2 592 256s-34.5-142.2-89.1-186.5c-10.1-8.4-11.5-23.6-3.2-33.8s23.6-11.5 33.8-3.2zM473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.1 8.4-25.3 6.9-33.8-3.2s-6.9-25.3 3.2-33.8C483.8 339.3 504 300.6 504 256s-20.2-83.3-61.5-111.2c-10.1-8.4-11.5-23.6-3.2-33.8s23.6-11.5 33.8-3.2zM301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z"/></svg>`; // Volume Icon
    } else {
        player.mute();
        volumeBtn.setAttribute('data-tooltip', 'Unmute');
        volumeBtn.innerHTML = `<svg viewBox="0 0 320 512"><path d="M301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3zM96 288H64c-8.8 0-16-7.2-16-16V240c0-8.8 7.2-16 16-16h32V288z"/></svg>`; // Mute Icon
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
    const container = document.getElementById('videoPlayerContainer'); // Target the player container
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        if (container.requestFullscreen) container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen(); // Safari
        else if (container.msRequestFullscreen) container.msRequestFullscreen();
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
    const volume = player.getVolume() / 100;

    // Update volume slider to match player state (e.g., if changed with keyboard)
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.value = player.isMuted() ? 0 : volume;
    }

    document.getElementById('progressBar').style.width = `${progress}%`;

    // Update card progress bar
    const currentVideoId = videoData[currentVideoIndex]?.id;
    if (currentVideoId) {
        const cardProgressBar = document.getElementById(`progress-bar-${currentVideoId}`);
        if (cardProgressBar) cardProgressBar.style.width = `${progress}%`;
        videoProgressData[currentVideoId] = progress;
        sessionStorage.setItem('videoProgress', JSON.stringify(videoProgressData));
    }

    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');

    if (currentTimeEl && durationEl) {
        currentTimeEl.textContent = formatTime(currentTime);
        durationEl.textContent = formatTime(duration);
    }
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

function populateSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    if (!menu) return;
    menu.innerHTML = ''; // Clear old items
    const speeds = [0.5, 1, 1.5, 2];
    speeds.forEach(speed => {
        const item = document.createElement('div');
        item.className = 'settings-menu-item';
        item.textContent = `${speed}x`;
        item.dataset.speed = speed;
        item.onclick = () => changePlaybackSpeed(speed);
        menu.appendChild(item);
    });
}

function changePlaybackSpeed(rate, isInitial = false) {
    if (player && typeof player.setPlaybackRate === 'function') {
        const speed = parseFloat(rate);
        player.setPlaybackRate(speed);

        // Update UI
        document.querySelectorAll('#settingsMenu .settings-menu-item').forEach(item => {
            item.classList.toggle('selected', parseFloat(item.dataset.speed) === speed);
        });

        if (!isInitial) {
            document.getElementById('settingsMenu').classList.remove('active');
        }
    }
}

function togglePictureInPicture() {
    if (document.pictureInPictureEnabled && videoPlayer.requestPictureInPicture) {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
        } else {
            videoPlayer.requestPictureInPicture().catch(error => {
                console.error("PiP Error:", error);
                alert("To use Picture-in-Picture, right-click twice on the video and select 'Picture in picture'.");
            });
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
        }

        // Load YouTube Iframe API script
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
});