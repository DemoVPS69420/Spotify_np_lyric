const container = document.getElementById('player-container');
const lyricsContainer = document.getElementById('lyrics-container');
const lyricsContent = document.getElementById('lyrics-content');
const bgGradient = document.querySelector('.bg-gradient');
const albumArt = document.getElementById('album-art');
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

// State
let lastTrackId = null;
let lastIsPlaying = false;
let hideTimeout = null;
let isEditing = false;
const colorThief = new ColorThief();

// Lyrics State
let currentLyrics = [];
let lastLyricIndex = -1;
let currentProgress = 0;
let lastUpdateTime = 0;
let isPlayingState = false;
let lastLineChangeTime = 0;

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
}

// --- Main Logic ---

async function fetchNowPlaying() {
    // Nếu đang chỉnh sửa thì không cập nhật ẩn/hiện, chỉ cập nhật thông tin nếu có
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
        
        // Sync time
        currentProgress = data.progress;
        lastUpdateTime = performance.now();
        isPlayingState = isPlaying;

        // Logic hiển thị:
        // 1. Đổi bài khi đang phát
        // 2. Tiếp tục phát (Resume)
        // 3. 20 giây cuối bài
        const songChanged = (currentTrackId !== lastTrackId);
        const resumed = (currentTrackId === lastTrackId) && (!lastIsPlaying && isPlaying);
        
        const timeLeft = data.duration - data.progress;
        const isNearEnd = (isPlaying && timeLeft <= 20000 && timeLeft > 0);

        // Update UI bất kể hiển thị hay không (để dữ liệu luôn mới)
        if (songChanged || (isPlaying && container.classList.contains('visible')) || isNearEnd) {
            updateUI(data);
        }
        
        if (songChanged) {
            if (isPlaying) {
                fetchLyrics(data);
            } else {
                lyricsContainer.classList.remove('visible');
            }
        }
        
        // Trigger hiển thị Player (Auto-hide logic applies ONLY to player)
        if ((songChanged && isPlaying) || resumed) {
            updateUI(data); 
            showNotification();
        } else if (isNearEnd) {
            // Show permanently during last 20s
            if (!container.classList.contains('visible') && !isEditing) {
                container.classList.add('visible');
            }
            // Cancel any pending hide timer so it stays up
            if (hideTimeout) clearTimeout(hideTimeout);
        }

        lastTrackId = currentTrackId;
        lastIsPlaying = isPlaying;

    } catch (error) {
        console.error('Error:', error);
    }
}

function updateUI(data) {
    // Chỉ cập nhật và check overflow nếu nội dung thực sự thay đổi
    if (trackName.textContent !== data.name) {
        trackName.textContent = data.name;
        checkOverflow(trackName);
    }
    
    if (artistName.textContent !== data.artist) {
        artistName.textContent = data.artist;
        checkOverflow(artistName);
    }

    // Load ảnh và cập nhật màu
    // Lưu ý: albumArt.src trả về full URL, nên so sánh có thể cần cẩn thận.
    // Tuy nhiên Spotify URL thường cố định.
    if (albumArt.getAttribute('src') !== data.albumArt) {
        albumArt.crossOrigin = "Anonymous";
        albumArt.src = data.albumArt;
        
        albumArt.onload = () => {
            try {
                const color = colorThief.getColor(albumArt);
                // Tạo gradient từ màu chủ đạo sang trong suốt/đen
                const rgbString = color.join(',');
                bgGradient.style.background = `linear-gradient(135deg, rgba(${rgbString}, 0.9) 0%, rgba(20,20,20, 0.95) 100%)`;
            } catch (e) {
                console.warn('Cannot extract color', e);
                bgGradient.style.background = `linear-gradient(135deg, rgba(50,50,50,0.9) 0%, rgba(20,20,20, 0.95) 100%)`;
            }
        };
    }
}

function checkOverflow(element) {
    // Reset trước khi đo
    element.classList.remove('marquee');
    element.parentElement.style.justifyContent = 'flex-start';

    // Đo độ rộng
    const parentWidth = element.parentElement.clientWidth;
    const contentWidth = element.scrollWidth;

    if (contentWidth > parentWidth) {
        element.classList.add('marquee');
    }
}

function showNotification() {
    if (isEditing) return;

    // Show Player
    container.classList.add('visible');
    
    if (hideTimeout) clearTimeout(hideTimeout);

    hideTimeout = setTimeout(() => {
        if (!isEditing) {
            container.classList.remove('visible');
            // Do NOT hide lyrics here.
        }
    }, 10000);
}

// --- Lyrics Logic ---

async function fetchLyrics(trackData) {
    lyricsContent.innerHTML = ''; // Clear for new song
    currentLyrics = [];
    lastLyricIndex = -1;
    lastLineChangeTime = performance.now(); // Reset timer

    try {
        const query = new URLSearchParams({
            id: trackData.id,
            name: trackData.name,
            artist: trackData.artist,
            duration: trackData.duration
        });

        const res = await fetch(`/api/lyrics?${query}`);
        if (!res.ok) throw new Error('No lyrics found');
        
        const data = await res.json();
        
        if (data.syncedLyrics) {
            parseLyrics(data.syncedLyrics);
            // Show lyrics container ONLY if we have synced lyrics
            lyricsContainer.classList.add('visible');
            lastLineChangeTime = performance.now(); // Reset again after load
        } else {
            // Display message when no synced lyrics are found
            console.log('No synced lyrics found. Displaying custom message.');
            lyricsContent.innerHTML = 
                `<div class="lyric-message">Bài hát này chưa có lời/chưa sync thời gian/chưa thêm lời vào spotify</div>` +
                `<div class="lyric-message-en">This song doesn't have lyrics/not synced/not added to spotify yet</div>`;
            lyricsContainer.classList.add('visible'); // Make sure container is visible for the message
            currentLyrics = []; // Clear any old lyrics
            lastLyricIndex = -1;
        }

    } catch (e) {
        console.warn('Lyrics fetch failed:', e);
        // Display error message
        lyricsContent.innerHTML = 
                `<div class="lyric-message">Không thể tải lời bài hát.</div>` +
                `<div class="lyric-message-en">Failed to load lyrics.</div>`;
        lyricsContainer.classList.add('visible');
        currentLyrics = []; // Clear any old lyrics
        lastLyricIndex = -1;
    }
}

function parseLyrics(lrc) {
    const lines = lrc.split('\n');
    // Improved Regex: Allow [00:00.00] or [00:00:00] and loose start
    const regex = /^\[(\d{2}):(\d{2})[\.:](\d{2,3})\](.*)/;
    
    currentLyrics = lines.map(line => {
        const match = line.match(regex);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            // Take up to 3 digits for MS
            const msStr = match[3];
            // If 2 digits, treat as 10ms units? No, Lrc usually means direct ms.
            // Standard: .xx = 1/100s -> *10. .xxx = 1/1000s.
            let ms = 0;
            if (msStr.length === 2) {
                ms = parseInt(msStr) * 10;
            } else {
                ms = parseInt(msStr);
            }
            
            const time = min * 60000 + sec * 1000 + ms;
            const text = match[4].trim();
            return { time, text };
        }
        return null;
    }).filter(item => item !== null && item.text.length > 0); // Filter empty lines

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

    // Calculate interpolated progress
    const now = performance.now();
    const dt = now - lastUpdateTime;
    const interpolatedProgress = currentProgress + dt;

    // Find current line
    // We look for the last line that has time <= interpolatedProgress
    let activeIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentLyrics[i].time <= interpolatedProgress) {
            activeIndex = i;
        } else {
            break;
        }
    }

    if (activeIndex !== lastLyricIndex) {
        lastLyricIndex = activeIndex;
        updateLyricsDisplay(activeIndex);
        
        // Line changed: Show lyrics and reset timer
        if (!isEditing) {
            lyricsContainer.classList.add('visible');
            lastLineChangeTime = now;
        }
    } else {
        // Line currently static
        if (isEditing) return; // Don't hide while editing

        const timeSinceChange = now - lastLineChangeTime;
        const isLastLine = (activeIndex === currentLyrics.length - 1);

        // Hide logic
        if (isLastLine) {
            // End of song: hide after 5 seconds
            if (timeSinceChange > 5000 && lyricsContainer.classList.contains('visible')) {
                lyricsContainer.classList.remove('visible');
            }
        } else {
            // Instrumental/Gap: hide after 10 seconds
            if (timeSinceChange > 10000 && lyricsContainer.classList.contains('visible')) {
                lyricsContainer.classList.remove('visible');
            }
        }
    }
}

function updateLyricsDisplay(index) {
    const lines = lyricsContent.querySelectorAll('.lyric-line');
    
    // Check if we should show the next line
    let showNext = true;
    if (index >= 0 && index < currentLyrics.length - 1) {
        const currentLineTime = currentLyrics[index].time;
        const nextLineTime = currentLyrics[index + 1].time;
        // If gap > 10 seconds, don't show next line
        if (nextLineTime - currentLineTime > 10000) {
            showNext = false;
        }
    }

    lines.forEach((line, i) => {
        // Reset classes
        line.classList.remove('active', 'next', 'previous');
        
        // Reset styles controlled by JS in default mode
        // For 'scroll' mode, CSS handles display via override
        line.style.display = ''; 
        
        if (i === index) {
            line.classList.add('active');
            // Explicit display for default mode compatibility
            // (Though CSS .active sets display:block, we keep this if logic varies)
             if (!lyricsContainer.classList.contains('anim-scroll')) {
                line.style.display = 'block';
             }
        } else if (i === index + 1 && showNext) {
            line.classList.add('next');
             if (!lyricsContainer.classList.contains('anim-scroll')) {
                line.style.display = 'block';
             }
        } else if (i === index - 1) {
             line.classList.add('previous');
        }
    });
}


// --- Drag & Drop Logic (Unified) ---

function makeDraggable(element, saveKey) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    element.addEventListener('mousedown', (e) => {
        if (!isEditing) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        element.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        element.style.left = `${initialLeft + dx}px`;
        element.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'move';
            
            // Save Position
            const rect = element.getBoundingClientRect();
            localStorage.setItem(saveKey, JSON.stringify({
                x: rect.left,
                y: rect.top
            }));
        }
    });
}

makeDraggable(container, 'widgetPosition');
makeDraggable(lyricsContainer, 'lyricsWidgetPosition');


// --- Edit Mode Toggle ---

settingsBtn.addEventListener('click', () => {
    isEditing = true;
    container.classList.add('visible'); 
    container.classList.add('editing');
    
    lyricsContainer.classList.add('visible');
    lyricsContainer.classList.add('editing');

    editOverlay.classList.remove('hidden');
    
    if (hideTimeout) clearTimeout(hideTimeout);
});

saveBtn.addEventListener('click', () => {
    isEditing = false;
    container.classList.remove('editing');
    lyricsContainer.classList.remove('editing');
    editOverlay.classList.add('hidden');
    
    // Save Scales & Animation
    localStorage.setItem('widgetScale', scaleSlider.value);
    localStorage.setItem('lyricsScale', lyricsScaleSlider.value);
    localStorage.setItem('lyricsAnimation', lyricsAnimSelect.value);
    
    // Ẩn Player sau 2 giây (Lyrics giữ nguyên nếu đang hát)
    setTimeout(() => {
        container.classList.remove('visible');
        // Không ẩn lyricsContainer ở đây, nó tự quản lý bởi fetchNowPlaying
    }, 2000);
});


// Loops
setInterval(fetchNowPlaying, 1000); // Sync data with server
setInterval(syncLyrics, 100); // Sync lyrics UI (interpolation)

fetchNowPlaying();
