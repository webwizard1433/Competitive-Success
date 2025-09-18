const modal = document.getElementById('videoModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoGrid = document.getElementById('videoGrid');

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
            // Use specific thumbnails if provided (like for history page)
            thumbnailUrl = defaultThumbnails.placeholder || defaultThumbnails.ancient || defaultThumbnails.default || `https://via.placeholder.com/320x180.png?text=Video`;
        }

        // Special thumbnail logic for history page
        if (defaultThumbnails.ancient && index < 9) thumbnailUrl = defaultThumbnails.ancient;
        if (defaultThumbnails.medieval && index >= 9 && index < 14) thumbnailUrl = defaultThumbnails.medieval;
        if (defaultThumbnails.modern && index >= 14 && index < 47) thumbnailUrl = defaultThumbnails.modern;

        card.innerHTML = `
            <div class="card-thumbnail loading">
                <img data-src="${thumbnailUrl}" alt="${video.title}">
                <span class="play-icon">▶</span>
            </div>
            <div class="card-content">
                <h3>${video.title}</h3>
            </div>
        `;
        card.onclick = () => openModal(video);
        videoGrid.appendChild(card);

        // Observe the image for lazy loading
        const img = card.querySelector('img');
        lazyLoadObserver.observe(img);
    });
}

// Function to open the modal and play the video
function openModal(video) {
    if (!video || !video.id) return;

    let embedUrl = '';

    if (video.id.startsWith('placeholder_')) {
        alert('This is a placeholder video. The link needs to be updated.');
        return;
    }

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