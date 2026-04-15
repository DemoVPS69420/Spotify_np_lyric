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

// Theme Controls
const themeSelect = document.getElementById('theme-select');
const obsCanvas   = document.getElementById('obs-canvas');

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

// Progress bar state (used by Spotify Green theme)
let currentDuration = 0;

// [FIX] Stale fetch guard — prevents old lyrics from overriding a newer song's lyrics
// Each fetchLyrics call gets a unique ID; if the song changes mid-fetch, the old result is discarded
let currentFetchId = 0;

// --- Helper: Safe Animation (Support Anime.js v3 & v4) ---
// [FIX] Removed dead-code branch that reassigned `targets` from params —
// it was never triggered (all callers pass 2 args) and had a subtle bug where
// `params` still carried a `.targets` key after reassignment, causing duplicate
// targets when spread into anime({targets, ...params}).
function safeAnimate(targets, params) {
    if (typeof anime === 'function') {
        // Anime.js v3: anime({ targets, ...animationProps })
        return anime({ targets, ...params });
    } else if (typeof anime === 'object' && typeof anime.animate === 'function') {
        // Anime.js v4: anime.animate(targets, animationProps)
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

// Load Theme
const savedTheme = localStorage.getItem('overlayTheme') || 'classic';
themeSelect.value = savedTheme;
applyTheme(savedTheme);

// --- Theme Logic ---
function applyTheme(theme) {
    obsCanvas.classList.toggle('theme-green', theme === 'green');
}

// --- Progress Bar Logic (Spotify Green theme) ---
function updateProgressBar(progress, duration) {
    const fill    = document.getElementById('progress-bar-fill');
    const curEl   = document.getElementById('progress-current');
    const durEl   = document.getElementById('progress-duration');
    if (!fill) return;
    const pct = duration > 0 ? (progress / duration * 100) : 0;
    fill.style.width = pct + '%';
    const fmt = ms => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    };
    curEl.textContent = fmt(progress);
    durEl.textContent = fmt(duration);
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
        currentDuration = data.duration;
        lastUpdateTime = performance.now();
        isPlayingState = isPlaying;
        updateProgressBar(data.progress, data.duration);

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
            // [FIX] Defer showNotification until media is fully ready (art + canvas loaded).
            // Pass it as a callback so updateUI triggers it only after flip animation is set up.
            // For "resumed" (same song, media already loaded): notify immediately below.
            // For song change while "always show" is on: box already visible, no deferred wait needed.
            const notifyOnReady = (songChanged && isPlaying && !alwaysShowCheckbox.checked)
                ? showNotification
                : null;
            updateUI(data, songChanged, notifyOnReady);
        }

        if (songChanged) {
            if (isPlaying) {
                fetchLyrics(data);
            } else {
                lyricsContainer.classList.remove('visible');
            }
        }

        // Resumed: same song, media already displayed — show immediately
        if (resumed) {
            showNotification();
        } else if (isNearEnd) {
            if (!container.classList.contains('visible') && !isEditing) {
                container.classList.add('visible');
            }
            if (hideTimeout) clearTimeout(hideTimeout);
        }
        // Note: songChanged && isPlaying → notification is now deferred inside updateUI via onReady

        lastTrackId = currentTrackId;
        lastIsPlaying = isPlaying;

    } catch (error) {
        console.error('Error:', error);
    }
}

// onReady: optional callback fired once all media is loaded and flip is triggered.
// This allows the caller to defer showing the container until content is truly ready.
async function updateUI(data, songChanged, onReady = null) {
    // 1. Update Text (always, regardless of songChanged)
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

    // 2. No media change — notify immediately (text was the only update)
    if (!songChanged) {
        onReady?.();
        return;
    }

    // 3. Song changed — load art + canvas, then flip, then notify
    const targetIndex = 1 - currentSlideIndex;
    const targetSlide = slides[targetIndex];
    const targetImg = targetSlide.querySelector('.album-art');
    const targetVideo = targetSlide.querySelector('.album-video');

    // [FIX] Capture track ID in closure to guard against rapid song skipping
    const expectedTrackId = data.id;

    // Reset target slide
    targetVideo.classList.remove('visible');
    targetVideo.pause();
    targetVideo.src = '';
    targetImg.crossOrigin = 'Anonymous';
    targetImg.src = data.albumArt;

    // [FIX] One-shot notifier: fires onReady exactly once even if multiple paths resolve.
    // Also clears the safety timeout so it doesn't double-fire.
    let mediaNotified = false;
    const notifyReady = () => {
        if (mediaNotified) return;
        mediaNotified = true;
        clearTimeout(safetyTimer);
        onReady?.();
    };

    // [FIX] Safety fallback: if image or canvas stalls for any reason,
    // show the box after 5s rather than leaving it permanently hidden.
    const safetyTimer = onReady ? setTimeout(notifyReady, 5000) : null;

    // [FIX] Handle broken album art (e.g. network error) — flip & notify anyway
    targetImg.onerror = () => {
        if (lastTrackId !== expectedTrackId) return;
        artWrapper.style.height = '90px';
        triggerFlip(targetIndex);
        notifyReady();
    };

    targetImg.onload = async () => {
        // [FIX] Guard: stale if song changed again while image was loading
        if (lastTrackId !== expectedTrackId) {
            clearTimeout(safetyTimer);
            return;
        }

        // Extract dominant color for background gradient
        try {
            const color = colorThief.getColor(targetImg);
            const rgbString = color.join(',');
            bgGradient.style.background = `linear-gradient(135deg, rgba(${rgbString}, 0.9) 0%, rgba(20,20,20, 0.95) 100%)`;
        } catch (e) {
            bgGradient.style.background = `linear-gradient(135deg, rgba(50,50,50,0.9) 0%, rgba(20,20,20, 0.95) 100%)`;
        }

        // Fetch Spotify Canvas video for this track
        try {
            const res = await fetch(`/api/canvas?trackId=${expectedTrackId}`);
            const canvasData = await res.json();

            // [FIX] Guard after async canvas fetch
            if (lastTrackId !== expectedTrackId) {
                clearTimeout(safetyTimer);
                return;
            }

            if (canvasData.canvasUrl) {
                targetVideo.src = canvasData.canvasUrl;
                targetVideo.onloadeddata = () => {
                    // [FIX] Guard inside video load
                    if (lastTrackId !== expectedTrackId) return;
                    const videoRatio = targetVideo.videoHeight / targetVideo.videoWidth;
                    if (obsCanvas.classList.contains('theme-green')) {
                        // Green theme: art wrapper is full card width.
                        // Height must match the video's actual ratio — no artificial cap
                        // so object-fit:cover fills without distortion.
                        const wrapW = artWrapper.offsetWidth || container.offsetWidth || 270;
                        artWrapper.style.height = `${wrapW * videoRatio}px`;
                    } else {
                        // Classic theme: wrapper is 90px wide
                        artWrapper.style.height = `${90 * videoRatio}px`;
                    }
                    targetVideo.classList.add('visible');
                    targetVideo.play().catch(() => {});
                    triggerFlip(targetIndex);
                    notifyReady(); // ✓ Art + Canvas loaded — safe to show
                };
            } else {
                // No canvas — album art only
                if (obsCanvas.classList.contains('theme-green')) {
                    // Make the container square to match album art (always 1:1)
                    const wrapW = artWrapper.offsetWidth || container.offsetWidth || 270;
                    artWrapper.style.height = `${wrapW}px`;
                } else {
                    artWrapper.style.height = '90px';
                }
                triggerFlip(targetIndex);
                notifyReady(); // ✓ Art loaded, no canvas — safe to show
            }
        } catch (e) {
            // Canvas fetch failed — fall back to square album art
            if (obsCanvas.classList.contains('theme-green')) {
                const wrapW = artWrapper.offsetWidth || container.offsetWidth || 270;
                artWrapper.style.height = `${wrapW}px`;
            } else {
                artWrapper.style.height = '90px';
            }
            triggerFlip(targetIndex);
            notifyReady(); // ✓ Canvas failed gracefully — safe to show
        }
    };
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
    // [FIX] Claim a unique fetch slot — any previous pending fetch is now considered stale
    const fetchId = ++currentFetchId;

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

        // [FIX] Song may have changed while we were awaiting — discard stale result
        if (fetchId !== currentFetchId) return;

        if (!res.ok) throw new Error('No lyrics found');
        const data = await res.json();

        // [FIX] Check again after JSON parse (another async boundary)
        if (fetchId !== currentFetchId) return;

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
        if (fetchId !== currentFetchId) return; // Stale — don't overwrite UI
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
    // [FIX] Cap dt at 3 seconds — prevents lyric from jumping wildly forward if:
    // - the browser tab was backgrounded/throttled
    // - network latency delayed the last fetchNowPlaying response
    // Beyond 3s without a server update, we trust the server timestamp more than interpolation
    const dt = Math.min(now - lastUpdateTime, 3000);
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
    localStorage.setItem('overlayTheme', themeSelect.value);
    applyTheme(themeSelect.value);
    if (alwaysShowCheckbox.checked === false) setTimeout(() => container.classList.remove('visible'), 2000);
});

async function pollNowPlaying() {
    await fetchNowPlaying();
    const nextDelay = isPlayingState ? 1000 : 5000;
    setTimeout(pollNowPlaying, nextDelay);
}

setInterval(syncLyrics, 100);
pollNowPlaying();
