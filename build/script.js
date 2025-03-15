let player;
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("yt", {
    videoId: document.querySelector("[data-track-id]")?.dataset.trackId,
    playerVars: {
      enablejsapi: 1,
      origin: location.origin,
    },
    events: {
      onStateChange: (event) => {
        document
          .getElementById("yt")
          .closest("music-player")
          ?.dispatchEvent(new CustomEvent("statechange", { detail: event }));
      },
    },
  });
  document
    .querySelectorAll("music-player .track-list play-track button")
    .forEach((btn) => (btn.disabled = false));
};
const textProp = (element, key, selector, textTransformFunction = (t) => t) => {
  Object.defineProperty(element, key, {
    get() {
      element.querySelector(selector).innerText;
    },
    set(text) {
      const currentValue = element.querySelector(selector).innerText;
      if (text !== currentValue) {
        element.querySelector(selector).innerText = textTransformFunction(text);
      }
    },
  });
};
const attrProp = (element, attrName) => {
  const normalizedName = attrName.toLowerCase();
  Object.defineProperty(element, attrName, {
    get() {
      const value = element.getAttribute(normalizedName);
      return value === "" || value;
    },
    set(value) {
      if (value === true) {
        element.setAttribute(normalizedName, "");
      } else if ([false, undefined, null].includes(value)) {
        element.removeAttribute(normalizedName);
      } else {
        element.setAttribute(normalizedName, value);
      }
    },
  });
};

document.body.addEventListener("keydown", (e) => {
  if (e.key === " " && !e.target.matches("button")) e.preventDefault();
});

class MusicPlayer extends HTMLElement {
  static STATES = {
    "-1": "not-playing",
    0: "not-playing",
    5: "not-playing",
    1: "playing",
    2: "paused",
    3: "buffering",
  };
  constructor() {
    super();
    attrProp(this, "currentTrack");
    attrProp(this, "state");
    textProp(this, "trackTitle", "music-controls .title");
    textProp(this, "trackArtist", "music-controls .artist");
    Object.defineProperty(this, "trackList", {
      get() {
        return Array.from(this.querySelectorAll("[data-track-id]")).map(
          (el) => el.dataset.trackId
        );
      },
    });
    Object.defineProperty(this, "selectedTrackIndex", {
      get() {
        return this.trackList.indexOf(this.currentTrack);
      },
    });
    Object.defineProperty(this, "track", {
      set(trackData) {
        /* trigger reflow to reset animation state on song change */
        this.albumArt.offsetHeight;
        this.currentTrack = trackData?.id;
        this.albumArt.style.backgroundImage = `url(https://i.ytimg.com/vi/${this.currentTrack}/hqdefault.jpg)`;
        this.trackTitle = trackData?.title;
        this.trackArtist = trackData?.artist;
      },
    });
  }
  connectedCallback() {
    this.progress = this.querySelector("music-progress");
    this.albumArt = this.querySelector("music-controls .album-art");
    this.previousButton = this.querySelector("previous-button");
    this.playButton = this.querySelector("play-button");
    this.nextButton = this.querySelector("next-button");

    this.addEventListener("statechange", (e) => {
      const trackData = player.getVideoData();
      this.currentTrack = trackData.video_id;

      this.state = MusicPlayer.STATES[e.detail.data] ?? false;
      this.progress.duration = player.getDuration();
      this.progress.value = player.getCurrentTime();

      this.querySelectorAll("[data-track-id]").forEach?.((li) =>
        li.classList.remove("selected")
      );
      const selectedTrack = this.querySelector(
        `[data-track-id="${this.currentTrack}"]`
      );
      selectedTrack?.classList.add("selected");

      if (this.currentTrack && this.state === "playing") {
        this.track = selectedTrack?.querySelector("play-track")?.track;
      }

      if (["buffering", "not-playing"].includes(this.state)) {
        this.progress.seeker.disabled = true;
        this.previousButton.disabled = true;
        this.playButton.disabled = true;
        this.nextButton.disabled = true;
        if (this.state === "not-playing") {
          this.progress.duration = 0;
          this.progress.value = 0;
        }
      }
      if (["playing", "paused"].includes(this.state)) {
        this.progress.seeker.disabled = false;
        this.previousButton.disabled = this.selectedTrackIndex === 0;
        this.playButton.disabled = false;
        this.nextButton.disabled =
          this.trackList.length === this.selectedTrackIndex + 1;
      }
    });
    this.addEventListener("play", (e) => {
      this.currentTrack = e?.detail?.track?.id;
      this.track = e?.detail?.track;
      player.getPlaylist() === this.trackList
        ? player.playVideoAt(this.selectedTrackIndex)
        : player.loadPlaylist(this.trackList, this.selectedTrackIndex);
    });
    this.addEventListener("pause", (e) => player.pauseVideo());
    this.addEventListener("resume", (e) => player.playVideo());
    this.addEventListener("previous", (e) => {
      this.currentTrack = this.trackList[this.currentTrack - 1];
      player.previousVideo();
    });
    this.addEventListener("next", (e) => {
      this.currentTrack = this.trackList[this.currentTrack + 1];
      player.nextVideo();
    });

    setInterval(() => {
      if (this.state === "playing") {
        this.progress.value = player.getCurrentTime();
      }
    }, 500);

    document.body.addEventListener("keyup", (e) => {
      e.preventDefault();
      if (e.key === " ") {
        if (["paused", "not-playing"].includes(this.state)) {
          this.dispatchEvent(new Event("resume"));
        }
        if (this.state === "playing") {
          this.dispatchEvent(new Event("pause"));
        }
      }
      if (
        ["j", "k"].includes(e.key) &&
        ["playing", "paused"].includes(this.state)
      ) {
        const focusedTrack =
          document.activeElement?.closest("li[data-track-id]")?.dataset
            ?.trackId === this.currentTrack;
        if (e.key === "j") this.dispatchEvent(new Event("next"));
        if (e.key === "k") this.dispatchEvent(new Event("previous"));
        if (focusedTrack) document.activeElement.blur();
      }
    });
  }
}
customElements.define("music-player", MusicPlayer);

class PlayTrack extends HTMLElement {
  constructor() {
    super();
    Object.defineProperty(this, "selected", {
      get() {
        return this.closest("li").classList.contains("selected");
      },
    });
    Object.defineProperty(this, "playerState", {
      get() {
        return this.closest("music-player")?.state;
      },
    });
    Object.defineProperty(this, "track", {
      get() {
        return {
          id: this.closest("li")?.dataset?.trackId,
          title: this.querySelector(".title")?.innerText,
          artist: this.querySelector(".artist")?.innerText,
        };
      },
    });
  }
  connectedCallback() {
    this.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.selected) {
        switch (this.playerState) {
          case "playing":
            this.dispatchEvent(new Event("pause", { bubbles: true }));
            break;
          case "paused":
            this.dispatchEvent(new Event("resume", { bubbles: true }));
            break;
        }
      } else {
        this.dispatchEvent(
          new CustomEvent("play", {
            bubbles: true,
            detail: { track: this.track },
          })
        );
      }
    });
  }
}
customElements.define("play-track", PlayTrack);

class PreviousButton extends HTMLElement {
  constructor() {
    super();
    Object.defineProperty(this, "disabled", {
      get() {
        return this.button.disabled;
      },
      set(bool) {
        this.button.disabled = bool;
      },
    });
  }
  connectedCallback() {
    this.button = this.querySelector("button");
    this.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dispatchEvent(new Event("previous", { bubbles: true }));
    });
  }
}
customElements.define("previous-button", PreviousButton);

class PlayButton extends HTMLElement {
  constructor() {
    super();
    Object.defineProperty(this, "playerState", {
      get() {
        return this.closest("music-player")?.state;
      },
    });
    Object.defineProperty(this, "disabled", {
      get() {
        return this.button.disabled;
      },
      set(bool) {
        this.button.disabled = bool;
      },
    });
  }
  connectedCallback() {
    this.button = this.querySelector("button");
    this.addEventListener("click", (e) => {
      e.stopPropagation();
      switch (this.playerState) {
        case "playing":
          this.dispatchEvent(new Event("pause", { bubbles: true }));
          break;
        case "paused":
          this.dispatchEvent(new Event("resume", { bubbles: true }));
          break;
      }
    });
  }
}
customElements.define("play-button", PlayButton);

class NextButton extends HTMLElement {
  constructor() {
    super();
    Object.defineProperty(this, "disabled", {
      get() {
        return this.button.disabled;
      },
      set(bool) {
        this.button.disabled = bool;
      },
    });
  }
  connectedCallback() {
    this.button = this.querySelector("button");
    this.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dispatchEvent(new Event("next", { bubbles: true }));
    });
  }
}
customElements.define("next-button", NextButton);

const formatDuration = (duration) => {
  duration = Math.ceil(parseFloat(duration));
  if (isNaN(duration)) {
    return "00:00";
  }
  let hours = Math.floor(duration / 3600);
  let minutes = Math.floor((duration % 3600) / 60)
    .toString()
    .padStart(2, "0");
  let seconds = Math.floor(duration % 60)
    .toString()
    .padStart(2, "0");

  return hours > 0
    ? [hours, minutes, seconds].join(":")
    : [minutes, seconds].join(":");
};
class MusicProgress extends HTMLElement {
  static observedAttributes = ["value", "duration"];
  constructor() {
    super();
    this.seeking = false;
    attrProp(this, "value");
    attrProp(this, "duration");
    textProp(this, "text", "div");
    Object.defineProperty(this, "playerState", {
      get() {
        return this.closest("music-player")?.state;
      },
    });
  }
  connectedCallback() {
    this.seeker = this.querySelector("input[type=range]");
    this.seeker.addEventListener("pointerdown", (e) => {
      if (this.playerState !== "buffering") this.seeking = true;
    });
    this.seeker.addEventListener("pointerup", (e) => {
      if (this.playerState !== "buffering") {
        player.seekTo(parseFloat(this.seeker.value), true);
        this.seeking = false;
      }
    });

    /* keyboard input */
    /* keydown fires before input, beforeinput doesn't work with range 
           input keyboard events */
    let originalValue;
    this.seeker.addEventListener("keydown", (e) => {
      originalValue = this.seeker.value;
    });
    this.seeker.addEventListener("input", (e) => {
      /* if pointer is not pressed */
      if (!this.seeking && this.playerState !== "buffering") {
        const direction = originalValue < this.seeker.value ? 1 : -1;
        player.seekTo(
          parseFloat(this.seeker.value) +
            (direction * parseFloat(this.duration)) / 20,
          true
        );
      }
    });
  }
  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case "duration":
        this.seeker.max = newValue;
        this.text = `${formatDuration(this.value)} / ${formatDuration(
          newValue
        )}`;
        break;
      case "value":
        if (!this.seeking) this.seeker.value = newValue;
        this.text = `${formatDuration(newValue)} / ${formatDuration(
          this.duration
        )}`;
        break;
    }
  }
}
customElements.define("music-progress", MusicProgress);
