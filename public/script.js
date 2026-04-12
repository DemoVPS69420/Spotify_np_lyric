const container = document.getElementById('player-container');
const lyricsContainer = document.getElementById('lyrics-container');
const lyricsContent = document.getElementById('lyrics-content');
const bgGradient = document.querySelector('.bg-gradient');
const artWrapper = document.querySelector('.art-wrapper');
const artInner = document.querySelector('.art-inner');
const trackName = document.getElementById('track-name');
const artistName = document.getElementById('artist-name');
const loginMsg = document.getElementById('login-msg');

// Edit Mode Elements
const settingsBtn = document.getElementById('settings-btn');
const editOverlay = document.getElementById('edit-overlay');
const saveBtn = document.getElementById('save-btn');

// Player Scale Controls
const scaleSlider = document.getElementById('scale-slider');
const scaleValueDisplay = document.getElementById('scale-value');

// Lyrics Scale Controls
const lyricsScaleSlider = document.getElementById('lyrics-scale-slider');
const lyricsScaleValueDisplay = document.getElementById('lyrics-scale-value');

// Lyrics Animation Controls
const lyricsAnimSelect = document.getElementById('lyrics-animation-select');

// Always Show Option
const alwaysShowCheckbox = document.getElementById('always-show-player');

// Background Controls
const bgUpload = document.getElementById('bg-upload');
const bgReset = document.getElementById('bg-reset');

// State
let lastTrackId = null;
let lastIsPlaying = false;
let hideTimeout = null;
let isEditing = false;
const colorThief = new ColorThief();

// Flip Art State
let currentSlideIndex = 0; 
let isFlipped = false;
const slides = [
    document.getElementById('art-current'),
    document.getElementById('art-next')
];

// Lyrics State
let currentLyrics = [];
let lastLyricIndex = -1;
let currentProgress = 0;
let lastUpdateTime = 0;
let isPlayingState = false;
let lastLineChangeTime = 0;

// --- Helper: Safe Animation (Support Anime.js v3 & v4) ---
function safeAnimate(targets, params) {
    if (!params && typeof targets === 'object' && targets.targets) {
        params = targets;
        targets = params.targets;
    }
    if (typeof anime === 'function') {
        return anime({ targets, ...params });
    } else if (typeof anime === 'object' && typeof anime.animate === 'function') {
        return anime.animate(targets, params);
    }
}

// --- Initialization ---

// Load saved position
const savedPos = JSON.parse(localStorage.getItem('widgetPosition'));
if (savedPos) {
    container.style.left = savedPos.x + 'px';
    container.style.top = savedPos.y + 'px';
}

const savedLyricsPos = JSON.parse(localStorage.getItem('lyricsWidgetPosition'));
if (savedLyricsPos) {
    lyricsContainer.style.left = savedLyricsPos.x + 'px';
    lyricsContainer.style.top = savedLyricsPos.y + 'px';
}

// Load saved scales
const savedScale = localStorage.getItem('widgetScale') || 1;
container.style.setProperty('--scale', savedScale);
scaleSlider.value = savedScale;
scaleValueDisplay.textContent = Math.round(savedScale * 100) + '%';

const savedLyricsScale = localStorage.getItem('lyricsScale') || 1;
lyricsContainer.style.setProperty('--lyrics-scale', savedLyricsScale);
lyricsScaleSlider.value = savedLyricsScale;
lyricsScaleValueDisplay.textContent = Math.round(savedLyricsScale * 100) + '%';

// Load saved animation
const savedAnim = localStorage.getItem('lyricsAnimation') || 'none';
lyricsAnimSelect.value = savedAnim;
updateLyricsAnimationClass(savedAnim);

// Load Always Show Option
const savedAlwaysShow = localStorage.getItem('alwaysShowPlayer') === 'true';
alwaysShowCheckbox.checked = savedAlwaysShow;
if (savedAlwaysShow) {
    container.classList.add('visible');
}

// --- Background Logic ---
function applyCustomBackground() {
    const bgData = localStorage.getItem('customBg');
    if (bgData) {
        document.body.style.backgroundImage = `url(${bgData})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
    } else {
        document.body.style.backgroundImage = '';
    }
}

applyCustomBackground();

bgUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const result = event.target.result;
            try {
                localStorage.setItem('customBg', result);
                applyCustomBackground();
            } catch (err) {
                console.error("Storage failed:", err);
                alert("Ảnh quá lớn để lưu vào trình duyệt. Hãy thử ảnh nhỏ hơn.");
            }
        };
        reader.readAsDataURL(file);
    }
});

bgReset.addEventListener('click', () => {
    localStorage.removeItem('customBg');
    applyCustomBackground();
    bgUpload.value = ''; 
});

// --- Scale Logic ---
scaleSlider.addEventListener('input', (e) => {
    const newVal = e.target.value;
    container.style.setProperty('--scale', newVal);
    scaleValueDisplay.textContent = Math.round(newVal * 100) + '%';
});

lyricsScaleSlider.addEventListener('input', (e) => {
    const newVal = e.target.value;
    lyricsContainer.style.setProperty('--lyrics-scale', newVal);
    lyricsScaleValueDisplay.textContent = Math.round(newVal * 100) + '%';
});

lyricsAnimSelect.addEventListener('change', (e) => {
    updateLyricsAnimationClass(e.target.value);
});

function updateLyricsAnimationClass(animType) {
    lyricsContainer.classList.remove('anim-scroll');
    if (animType === 'scroll') {
        lyricsContainer.classList.add('anim-scroll');
    }
    if (lastLyricIndex !== -1) {
        updateLyricsDisplay(lastLyricIndex);
    }
}

// --- Main Logic ---

async function fetchNowPlaying() {
    if (isEditing) return;

    try {
        const response = await fetch('/api/now-playing');
        const data = await response.json();

        if (data.loggedIn === false) {
            container.classList.remove('visible');
            lyricsContainer.classList.remove('visible');
            loginMsg.style.display = 'block';
            return;
        } else {
            loginMsg.style.display = 'none';
        }

        const isPlaying = data.isPlaying;
        const currentTrackId = data.id;
        
        currentProgress = data.progress;
        lastUpdateTime = performance.now();
        isPlayingState = isPlaying;

        const songChanged = (currentTrackId !== lastTrackId);
        const resumed = (currentTrackId === lastTrackId) && (!lastIsPlaying && isPlaying);
        
        const timeLeft = data.duration - data.progress;
        const isNearEnd = (isPlaying && timeLeft <= 20000 && timeLeft > 0);

        // Always show option
        if (alwaysShowCheckbox.checked && isPlaying && !container.classList.contains('visible')) {
            container.classList.add('visible');
        }

        // --- CORE UPDATE LOGIC ---
        if (songChanged || resumed || (isPlaying && container.classList.contains('visible')) || isNearEnd) {
            updateUI(data, songChanged);
        }
        
        if (songChanged) {
            if (isPlaying) {
                fetchLyrics(data);
            } else {
                lyricsContainer.classList.remove('visible');
            }
        }
        
        if ((songChanged && isPlaying) || resumed) {
            showNotification();
        } else if (isNearEnd) {
            if (!container.classList.contains('visible') && !isEditing) {
                container.classList.add('visible');
            }
            if (hideTimeout) clearTimeout(hideTimeout);
        }

        lastTrackId = currentTrackId;
        lastIsPlaying = isPlaying;

    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateUI(data, songChanged) {
    // 1. Update Text (Always check if change)
    if (trackName.textContent !== data.name) {
        if (typeof anime !== 'undefined' && typeof anime.remove === 'function') anime.remove(trackName);
        trackName.style.top = '-30px';
        trackName.style.opacity = '0';
        trackName.textContent = data.name;
        checkOverflow(trackName);
        
        safeAnimate(trackName, {
            top: 0,
            opacity: 1,
            duration: 600,
            easing: 'easeOutExpo',
            delay: 100
        });
    }
    
    if (artistName.textContent !== data.artist) {
        if (typeof anime !== 'undefined' && typeof anime.remove === 'function') anime.remove(artistName);
        artistName.style.top = '20px';
        artistName.style.opacity = '0';
        artistName.textContent = data.artist;
        checkOverflow(artistName);
        
        safeAnimate(artistName, {
            top: 0,
            opacity: 1,
            duration: 600,
            easing: 'easeOutExpo',
            delay: 200
        });
    }

    // 2. Handle Flip & Media (Only if song changed)
    if (songChanged) {
        const targetIndex = 1 - currentSlideIndex;
        const targetSlide = slides[targetIndex];
        const targetImg = targetSlide.querySelector('.album-art');
        const targetVideo = targetSlide.querySelector('.album-video');

        // Reset target slide state
        targetVideo.classList.remove('visible');
        targetVideo.pause();
        targetVideo.src = "";
        targetImg.crossOrigin = "Anonymous";
        targetImg.src = data.albumArt;

        // Extract color and flip
        targetImg.onload = async () => {
            // Update Background Gradient
            try {
                const color = colorThief.getColor(targetImg);
                const rgbString = color.join(',');
                bgGradient.style.background = `linear-gradient(135deg, rgba(${rgbString}, 0.9) 0%, rgba(20,20,20, 0.95) 100%)`;
            } catch (e) {
                bgGradient.style.background = `linear-gradient(135deg, rgba(50,50,50,0.9) 0%, rgba(20,20,20, 0.95) 100%)`;
            }

            // Fetch Canvas for this specific track
            try {
                const res = await fetch(`/api/canvas?trackId=${data.id}`);
                const canvasData = await res.json();
                
                if (canvasData.canvasUrl) {
                    targetVideo.src = canvasData.canvasUrl;
                    targetVideo.onloadeddata = () => {
                        const videoRatio = targetVideo.videoHeight / targetVideo.videoWidth;
                        artWrapper.style.height = `${90 * videoRatio}px`;
                        targetVideo.classList.add('visible');
                        targetVideo.play().catch(() => {});
                        triggerFlip(targetIndex);
                    };
                } else {
                    artWrapper.style.height = '90px';
                    triggerFlip(targetIndex);
                }
            } catch (e) {
                artWrapper.style.height = '90px';
                triggerFlip(targetIndex);
            }
        };
    }
}

function triggerFlip(nextIndex) {
    if (currentSlideIndex === nextIndex) return;
    
    // Stop and Hide video on the PREVIOUS slide
    const prevSlide = slides[currentSlideIndex];
    const prevVideo = prevSlide.querySelector('.album-video');
    if (prevVideo) {
        prevVideo.pause();
        prevVideo.classList.remove('visible');
        prevVideo.src = "";
    }

    isFlipped = !isFlipped;
    safeAnimate(artInner, {
        rotateY: isFlipped ? 180 : 0,
        duration: 800,
        easing: 'easeInOutBack'
    });
    currentSlideIndex = nextIndex;
}

function checkOverflow(element) {
    element.classList.remove('marquee');
    element.parentElement.style.justifyContent = 'flex-start';
    element.style.left = '0';

    const parentWidth = element.parentElement.clientWidth;
    const contentWidth = element.scrollWidth;

    if (contentWidth > parentWidth) {
        element.classList.add('marquee');
        element.style.left = ''; 
    }
}

function showNotification() {
    if (isEditing) return;
    container.classList.add('visible');
    
    if (hideTimeout) clearTimeout(hideTimeout);

    if (!alwaysShowCheckbox.checked) {
        hideTimeout = setTimeout(() => {
            if (!isEditing && !alwaysShowCheckbox.checked) {
                container.classList.remove('visible');
            }
        }, 10000);
    }
}

// --- Lyrics Logic ---

async function fetchLyrics(trackData) {
    lyricsContent.innerHTML = '';
    currentLyrics = [];
    lastLyricIndex = -1;
    lastLineChangeTime = performance.now(); 

    try {
        const query = new URLSearchParams({
            id: trackData.id,
            name: trackData.name,
            artist: trackData.artist,
            duration: trackData.duration,
            isrc: trackData.isrc || ''
        });

        const res = await fetch(`/api/lyrics?${query}`);
        if (!res.ok) throw new Error('No lyrics found');
        const data = await res.json();
        if (data.syncedLyrics) {
            parseLyrics(data.syncedLyrics, data.offset || 0);
            lastLineChangeTime = performance.now(); 
        } else {
            lyricsContent.innerHTML = 
                `<div class="lyric-message">Bài hát này chưa có lời/chưa sync thời gian/chưa thêm lời vào spotify</div>` +
                `<div class="lyric-message-en">This song doesn't have lyrics/not synced/not added to spotify yet</div>`;
            lyricsContainer.classList.add('visible');
            currentLyrics = []; 
            lastLyricIndex = -1;
        }
    } catch (e) {
        lyricsContent.innerHTML = `<div class="lyric-message">Không thể tải lời bài hát.</div>`;
        lyricsContainer.classList.add('visible');
    }
}

function parseLyrics(lrc, offset = 0) {
    const lines = lrc.split('\n');
    const regex = /^\[(\d{2}):(\d{2})[\.:](\d{2,3})\](.*)/;
    currentLyrics = lines.map(line => {
        const match = line.match(regex);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const msStr = match[3];
            let ms = (msStr.length === 2) ? parseInt(msStr) * 10 : parseInt(msStr);
            const time = min * 60000 + sec * 1000 + ms + offset;
            const text = match[4].trim();
            return { time, text };
        }
        return null;
    }).filter(item => item !== null && item.text.length > 0);
    renderLyrics();
}

function renderLyrics() {
    lyricsContent.innerHTML = '';
    currentLyrics.forEach((line, index) => {
        const div = document.createElement('div');
        div.classList.add('lyric-line');
        div.textContent = line.text;
        div.dataset.index = index;
        lyricsContent.appendChild(div);
    });
}

function syncLyrics() {
    if (!isPlayingState || currentLyrics.length === 0) return;
    const now = performance.now();
    const dt = now - lastUpdateTime;
    const interpolatedProgress = currentProgress + dt;
    let activeIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentLyrics[i].time <= interpolatedProgress) activeIndex = i;
        else break;
    }
    if (activeIndex !== lastLyricIndex) {
        lastLyricIndex = activeIndex;
        updateLyricsDisplay(activeIndex);
        if (!isEditing) {
            lyricsContainer.classList.add('visible');
            lastLineChangeTime = now;
        }
    } else if (!isEditing) {
        const timeSinceChange = now - lastLineChangeTime;
        if (timeSinceChange > (activeIndex === currentLyrics.length - 1 ? 5000 : 10000)) {
            if (lyricsContainer.classList.contains('visible')) lyricsContainer.classList.remove('visible');
        }
    }
}

function updateLyricsDisplay(index) {
    if (lyricsContainer.classList.contains('anim-scroll') && typeof anime !== 'undefined') {
        updateLyricsAnime(index);
        return;
    }
    const lines = lyricsContent.querySelectorAll('.lyric-line');
    lines.forEach((line, i) => {
        line.classList.remove('active', 'next', 'previous');
        line.style.display = ''; 
        line.style.transform = '';
        line.style.opacity = '';
        if (i === index) {
            line.classList.add('active');
            if (!lyricsContainer.classList.contains('anim-scroll')) line.style.display = 'block';
        } else if (i === index + 1) {
            line.classList.add('next');
            if (!lyricsContainer.classList.contains('anim-scroll')) line.style.display = 'block';
        } else if (i === index - 1) {
            line.classList.add('previous');
        }
    });
}

function updateLyricsAnime(index) {
    const lines = lyricsContent.querySelectorAll('.lyric-line');
    lines.forEach((line, i) => {
        if (typeof anime !== 'undefined' && typeof anime.remove === 'function') anime.remove(line);
        if (i === index) {
            line.classList.add('active');
            safeAnimate(line, { translateY: '-50%', opacity: 1, filter: 'blur(0px)', duration: 500, easing: 'outExpo' });
        } else if (i === index - 1) {
            line.classList.add('previous');
            safeAnimate(line, { translateY: '-100px', opacity: 0, filter: 'blur(5px)', duration: 400, easing: 'outQuad' });
        } else {
            line.classList.remove('active', 'next', 'previous');
            if (parseFloat(window.getComputedStyle(line).opacity) > 0) {
                 safeAnimate(line, { translateY: '100px', opacity: 0, duration: 200, easing: 'linear' });
            }
        }
    });
}

// --- Drag & Drop ---
function makeDraggable(element, saveKey) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    element.addEventListener('mousedown', (e) => {
        if (!isEditing) return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        const rect = element.getBoundingClientRect();
        initialLeft = rect.left; initialTop = rect.top;
        element.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        element.style.left = `${initialLeft + e.clientX - startX}px`;
        element.style.top = `${initialTop + e.clientY - startY}px`;
    });
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'move';
            const rect = element.getBoundingClientRect();
            localStorage.setItem(saveKey, JSON.stringify({ x: rect.left, y: rect.top }));
        }
    });
}

makeDraggable(container, 'widgetPosition');
makeDraggable(lyricsContainer, 'lyricsWidgetPosition');

settingsBtn.addEventListener('click', () => {
    isEditing = true;
    container.classList.add('visible', 'editing');
    lyricsContainer.classList.add('visible', 'editing');
    editOverlay.classList.remove('hidden');
});

saveBtn.addEventListener('click', () => {
    isEditing = false;
    container.classList.remove('editing');
    lyricsContainer.classList.remove('editing');
    editOverlay.classList.add('hidden');
    localStorage.setItem('widgetScale', scaleSlider.value);
    localStorage.setItem('lyricsScale', lyricsScaleSlider.value);
    localStorage.setItem('lyricsAnimation', lyricsAnimSelect.value);
    localStorage.setItem('alwaysShowPlayer', alwaysShowCheckbox.checked);
    if (!alwaysShowCheckbox.checked) setTimeout(() => container.classList.remove('visible'), 2000);
});

setInterval(fetchNowPlaying, 1000);
setInterval(syncLyrics, 100);
fetchNowPlaying();
