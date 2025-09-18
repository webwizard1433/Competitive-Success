const modal = document.getElementById('videoModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoGrid = document.getElementById('videoGrid');
let userData = { progress: {}, favorites: [] };

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


// --- Core Functions ---

async function fetchUserData() {
    if (!userId) return;
    try {
        const response = await fetch(`/user/${userId}`);
        if (response.ok) {
            userData = await response.json();
        }
    } catch (error) {
        console.error("Could not fetch user data", error);
    }
}

// Function to create and append video cards
function populateVideos(videoData, defaultThumbnails) {
    videoData.forEach((video, index) => {
        const card = document.createElement('div');
        card.className = 'resource-card';
        
        let thumbnailUrl = '';
        if (video.type === 'gdrive') {
            thumbnailUrl = defaultThumbnails.gdrive || `https://via.placeholder.com/320x180.png?text=Video`;
        } else if (video.id && !video.id.startsWith('placeholder_')) {
            // Use medium quality thumbnail for faster loading
            thumbnailUrl = `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`;
        } else {
            // This is a placeholder video. Use the specific placeholder thumbnail if available.
            thumbnailUrl = defaultThumbnails.placeholder || `https://via.placeholder.com/320x180.png?text=Video+Not+Found`;
        }

        // Special thumbnail logic for history page, which has multiple thumbnails.
        // This will only run if the `ancient` thumbnail is defined.
        if (defaultThumbnails.ancient) {
            if (index < 9) thumbnailUrl = defaultThumbnails.ancient;
            else if (index >= 9 && index < 14) thumbnailUrl = defaultThumbnails.medieval;
            else if (index >= 14 && index < 47) thumbnailUrl = defaultThumbnails.modern;
        }

        card.innerHTML = `
            <div class="card-thumbnail loading">
                <img data-src="${thumbnailUrl}" alt="${video.title}">
                <span class="play-icon">▶</span>
            </div>
            <div class="card-content"> 
                <h3>${video.title}</h3>
                <div class="card-controls">
                    <div class="control-item">
                        <input type="checkbox" id="progress-${video.id}" class="progress-checkbox" ${userData.progress[video.id] ? 'checked' : ''}>
                        <label for="progress-${video.id}">Completed</label>
                    </div>
                    <div class="control-item">
                        <button class="favorite-btn ${isFavorited(video.id) ? 'favorited' : ''}" title="Add to favorites">
                            ⭐
                        </button>
                    </div>
                </div>
            </div>
        `;
        if (video.id.startsWith('placeholder_')) {
            card.classList.add('placeholder');
        } else {
            card.onclick = () => openModal(video);
        }

        videoGrid.appendChild(card);

        // Observe the image for lazy loading
        const img = card.querySelector('img');
        lazyLoadObserver.observe(img);
    });
}

function isFavorited(videoId) {
    return userData.favorites && userData.favorites.some(fav => fav.id === videoId);
}

async function handleProgressUpdate(videoId, isCompleted) {
    if (!userId) return;
    await fetch(`/user/${userId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, completed: isCompleted })
    });
}

async function handleFavoriteUpdate(video, button) {
    if (!userId) return;
    const isCurrentlyFavorited = button.classList.contains('favorited');
    const newFavoritedStatus = !isCurrentlyFavorited;

    const response = await fetch(`/user/${userId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video, favorited: newFavoritedStatus })
    });

    if (response.ok) {
        button.classList.toggle('favorited', newFavoritedStatus);
        // Update local user data to match
        if (newFavoritedStatus) {
            userData.favorites.push(video);
        } else {
            userData.favorites = userData.favorites.filter(v => v.id !== video.id);
        }
    }
}

// Function to open the modal and play the video
function openModal(video) {
    if (!video || !video.id) return;

    let embedUrl = '';

    if (video.type === 'gdrive') {
        embedUrl = `https://drive.google.com/file/d/${video.id}/preview`;
    } else { // Default to YouTube
        embedUrl = `https://www.youtube.com/embed/${video.id}?autoplay=1`;
    }

    videoPlayer.src = embedUrl;
    modal.classList.add('show');

    // Store the currently playing video ID in session storage
    if (window.sessionStorage) {
        sessionStorage.setItem('activeVideo', JSON.stringify(video));
    }
}

// Function to close the modal and stop the video
function closeModal() {
    modal.classList.remove('show');
    videoPlayer.src = ""; // Stop the video by clearing the src
    // Remove the video from session storage
    if (window.sessionStorage) {
        sessionStorage.removeItem('activeVideo');
    }
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