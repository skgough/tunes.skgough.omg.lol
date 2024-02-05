let player;
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('yt', {
        videoId: document.querySelector('[data-track-id]')?.dataset.trackId,
        playerVars: { 
            enablejsapi: 1,
            origin: location.origin
        },
        events: {
            onStateChange: event => {
                document.getElementById('yt')
                    .closest('music-player')
                    ?.dispatchEvent(
                        new CustomEvent(
                            'statechange',
                            { detail: event }
                        )
                    )
            }
        }
    });
    document.querySelectorAll('music-player .track-list [is="play-track"]')
            .forEach(btn => btn.disabled = false)
}
const textProp = (element, key, selector, textTransformFunction = t => t) => {
    Object.defineProperty(
        element,
        key,
        {
            get() {
                element.querySelector(selector).innerText;
            },
            set(text) {
                const currentValue = element.querySelector(selector).innerText;
                if (text !== currentValue) {
                    element.querySelector(selector).innerText = textTransformFunction(text);
                }
            }
        }
    )
}
const attrProp = (element, attrName) => {
    const normalizedName = attrName.toLowerCase()
    Object.defineProperty(
        element,
        attrName,
        {
            get() {
                const value = element.getAttribute(normalizedName);
                return (value === '') || value
            },
            set(value) {
                if (value === true) {
                    element.setAttribute(normalizedName, '');
                } else if ([false, undefined, null].includes(value)) {
                    element.removeAttribute(normalizedName);
                } else {
                    element.setAttribute(normalizedName, value)
                }
            }
        }
    )
}
const isInView = (element) => {
    const bounds = element?.getBoundingClientRect();
    return (
        bounds?.top >= 0 &&
        bounds?.left >= 0 &&
        bounds?.bottom <= window.innerHeight && 
        bounds?.right <= window.innerWidth
    );
}

class MusicPlayer extends HTMLElement {
    static STATES = {
        '-1': 'not-playing',
        '0': 'not-playing',
        '5': 'not-playing',
        '1': 'playing',
        '2': 'paused',
        '3': 'buffering'
    }
    constructor() {
        super();
        attrProp(this, 'currentTrack');
        attrProp(this, 'state');
        textProp(this, 'trackTitle', 'music-controls .title');
        textProp(
            this,
            'trackArtist',
            'music-controls .artist',
            t => t.replace(' - Topic', '')
        )
        Object.defineProperty(
            this,
            'trackList',
            {
                get() {
                    return Array.from(this.querySelectorAll('[data-track-id]'))
                                .map(el => el.dataset.trackId);
                }
            }
        );
        Object.defineProperty(
            this,
            'selectedTrackIndex',
            {
                get() {
                    return this.trackList.indexOf(this.currentTrack);
                }
            }
        )
    }
    connectedCallback() {
        /* disabling elements takes away their focus. Save the focused 
           element before disabling it to restore focus when elements 
           become interactive again. */
        this.lastFocusedElement = this.querySelector(':focus');

        this.progress = this.querySelector('music-progress');
        this.albumArt = this.querySelector('music-controls .album-art');
        this.previousButton = this.querySelector('[is=previous-button]');
        this.playButton = this.querySelector('[is=play-button]');
        this.nextButton = this.querySelector('[is=next-button]');

        this.addEventListener('statechange', e => {
            this.state = MusicPlayer.STATES[e.detail.data] ?? false;

            const trackData = player.getVideoData();
            this.currentTrack = trackData.video_id;
            this.trackTitle = trackData.title ?? '';
            this.trackArtist = trackData.author ?? '';
            this.progress.duration = player.getDuration();
            this.progress.value = player.getCurrentTime();

            this.querySelectorAll('[data-track-id]')
                .forEach?.(li => li.classList.remove('selected'));

            if (this.currentTrack) {
                this.querySelector(`[data-track-id="${this.currentTrack}"]`)
                    ?.classList.add('selected');
                this.albumArt.style.backgroundImage = `url(https://i.ytimg.com/vi/${this.currentTrack}/hqdefault.jpg)`;
            }
            
            if (['buffering', 'not-playing'].includes(this.state)) {
                this.lastFocusedElement = this.querySelector(':focus');
                this.progress.seeker.disabled = true;
                this.previousButton.disabled = true;
                this.playButton.disabled = true;
                this.nextButton.disabled = true;
                if (this.state === 'not-playing') {
                    this.currentTrack = false;
                    this.trackTitle = '';
                    this.trackArtist = '';
                    this.progress.duration = 0;
                    this.progress.value = 0;

                    /* trigger reflow to reset animation state on song change */
                    this.albumArt.offsetHeight;
                }
            }
            if (['playing', 'paused'].includes(this.state)) {
                this.progress.seeker.disabled = false;
                this.previousButton.disabled = this.selectedTrackIndex === 0;
                this.playButton.disabled = false;
                this.nextButton.disabled = this.trackList.length === this.selectedTrackIndex + 1;

                if (isInView(this.lastFocusedElement)) this.lastFocusedElement.focus();
            }
        });
        this.addEventListener('play', e => {
            this.currentTrack = e.detail?.trackId;
            const currentPlaylist = player.getPlaylist();
            if (currentPlaylist === this.trackList) {
                player.playVideoAt(this.selectedTrackIndex);
            } else {
                player.loadPlaylist(this.trackList, this.selectedTrackIndex);
            }
        });
        this.addEventListener('pause',    e => player.pauseVideo());
        this.addEventListener('resume',   e => player.playVideo());
        this.addEventListener('previous', e => player.previousVideo());
        this.addEventListener('next',     e => player.nextVideo());

        setInterval(() => {
            if (this.state === 'playing') {
                this.progress.value = player.getCurrentTime();
            }
        }, 500)
    }
}
customElements.define('music-player', MusicPlayer)

class PlayTrack extends HTMLButtonElement {
    constructor() {
        super();
        Object.defineProperty(this, 'selected', {
            get() {
                return this.closest('li').classList.contains('selected')
            }
        });
        Object.defineProperty(this, 'playerState', {
            get() {
                return this.closest('music-player')?.state
            }
        });
    }
    connectedCallback() {
        this.trackId = this.closest('[data-track-id]')?.dataset?.trackId;
        this.addEventListener('click', e => {
            if (this.selected) {
                switch (this.playerState) {
                    case 'playing':
                        this.dispatchEvent(new Event(
                            'pause',
                            { bubbles: true }
                        ))
                        break
                    case 'paused':
                        this.dispatchEvent(new Event(
                            'resume',
                            { bubbles: true }
                        ))
                        break
                }
            } else {
                this.dispatchEvent(new CustomEvent(
                    'play',
                    {
                        bubbles: true,
                        detail: { trackId: this.trackId }
                    }
                ))
            }
        });
    }
}
customElements.define('play-track', PlayTrack, { extends: 'button' })

/* fuck you safari let me use `is` */
Array.from(document.querySelectorAll('[is=play-track]'))
     .filter(el => !(el instanceof customElements.get('play-track')))
     .forEach(el => { 
        Object.defineProperty(el, 'selected', {
            get() {
                return el.closest('li').classList.contains('selected')
            }
        });
        Object.defineProperty(el, 'playerState', {
            get() {
                return el.closest('music-player')?.state
            }
        });
        el.trackId = el.closest('[data-track-id]')?.dataset?.trackId;
        el.addEventListener('click', e => {
            if (el.selected) {
                switch (el.playerState) {
                    case 'playing':
                        el.dispatchEvent(new Event(
                            'pause',
                            { bubbles: true }
                        ))
                        break
                    case 'paused':
                        el.dispatchEvent(new Event(
                            'resume',
                            { bubbles: true }
                        ))
                        break
                }
            } else {
                el.dispatchEvent(new CustomEvent(
                    'play',
                    {
                        bubbles: true,
                        detail: { trackId: el.trackId }
                    }
                ))
            }
        });
     });

class PreviousButton extends HTMLButtonElement {
    constructor() {
        super()
    }
    connectedCallback() {
        this.addEventListener('click', e => {
            this.dispatchEvent(new Event('previous', { bubbles: true }))
        })
    }
}
customElements.define('previous-button', PreviousButton, { extends: 'button' });

/* fuck you safari let me use `is` */
Array.from(document.querySelectorAll('[is=previous-button]'))
     .filter( el => !(el instanceof customElements.get('previous-button')))
     .forEach(el => { 
        el.addEventListener('click', e => {
            el.dispatchEvent(new Event('previous', { bubbles: true }))
        })
     });

class PlayButton extends HTMLButtonElement {
    constructor() {
        super()
        Object.defineProperty(this, 'playerState', {
            get() {
                return this.closest('music-player')?.state
            }
        })
    }
    connectedCallback() {
        this.addEventListener('click', e => {
            switch (this.playerState) {
                case 'playing':
                    this.dispatchEvent(new Event(
                        'pause',
                        { bubbles: true }
                    ))
                    break
                case 'paused':
                    this.dispatchEvent(new Event(
                        'resume',
                        { bubbles: true }
                    ))
                    break
            }
        })
    }
}
customElements.define('play-button', PlayButton, { extends: 'button' });

/* fuck you safari let me use `is` */
Array.from(document.querySelectorAll('[is=play-button]'))
     .filter( el => !(el instanceof customElements.get('play-button')))
     .forEach(el => {
        Object.defineProperty(el, 'playerState', {
            get() {
                return el.closest('music-player')?.state
            }
        })
        el.addEventListener('click', e => {
            switch (el.playerState) {
                case 'playing':
                    el.dispatchEvent(new Event(
                        'pause',
                        { bubbles: true }
                    ))
                    break
                case 'paused':
                    el.dispatchEvent(new Event(
                        'resume',
                        { bubbles: true }
                    ))
                    break
            }
        })
     })


class NextButton extends HTMLButtonElement {
    constructor() {
        super()
    }
    connectedCallback() {
        this.addEventListener('click', e => {
            this.dispatchEvent(new Event('next', { bubbles: true }))
        })
    }
}
customElements.define('next-button', NextButton, { extends: 'button' });

/* fuck you safari let me use `is` */
Array.from(document.querySelectorAll('[is=next-button]'))
     .filter( el => !(el instanceof customElements.get('next-button')))
     .forEach(el => {
        el.addEventListener('click', e => {
            el.dispatchEvent(new Event('next', { bubbles: true }))
        })
     })

const formatDuration = (duration) => {
    duration = parseFloat(duration);
    if (isNaN(duration)) {
        return '00:00'
    }

    let hours = Math.floor(duration / 3600);
    let minutes = Math.floor((duration % 3600) / 60);
    let seconds = Math.floor(duration % 60);

    if (seconds < 10) seconds = `0${seconds}`;
    if (hours > 0) {
        if (minutes < 10) minutes = `0${minutes}`;
        return [hours, minutes, seconds].join(':')
    } else {
        return [minutes, seconds].join(':')
    }

}
class MusicProgress extends HTMLElement {
    static observedAttributes = ['value', 'duration']
    constructor() {
        super();
        this.seeking = false;
        attrProp(this, 'value');
        attrProp(this, 'duration');
        textProp(this, 'text', 'div');
        Object.defineProperty(this, 'playerState', {
            get() {
                return this.closest('music-player')?.state
            }
        })
    }
    connectedCallback() {
        this.seeker = this.querySelector('input[type=range]');
        this.seeker.addEventListener('pointerdown', e => {
            if (this.playerState !== 'buffering') this.seeking = true;
        })
        this.seeker.addEventListener('pointerup', e => {
            if (this.playerState !== 'buffering') {
                player.seekTo(parseFloat(this.seeker.value), true);
                this.seeking = false;
            }
        })

        /* keyboard input */
        /* keydown fires before input, beforeinput doesn't work with range 
           input keyboard events */
        let originalValue;
        this.seeker.addEventListener('keydown', e => {
            originalValue = this.seeker.value;
        })
        this.seeker.addEventListener('input', e => {
            /* if pointer is not pressed */
            if (!this.seeking && this.playerState !== 'buffering') {
                const direction = originalValue < this.seeker.value ? 1 : -1;
                player.seekTo(
                    parseFloat(this.seeker.value) + (direction * parseFloat(this.duration) / 20),
                    true
                );
            }
        })
    }
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'duration':
                this.seeker.max = newValue;
                this.text = `${formatDuration(this.value)} / ${formatDuration(newValue)}`
                break
            case 'value':
                if (!this.seeking) this.seeker.value = newValue;
                this.text = `${formatDuration(newValue)} / ${formatDuration(this.duration)}`;
                break
        }
    }
}
customElements.define('music-progress', MusicProgress);
