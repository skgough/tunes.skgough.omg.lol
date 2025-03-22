class ToastDialog extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const dialog = this.querySelector("dialog");
    setTimeout(() => dialog.close(), 2500);
  }
}
customElements.define("toast-dialog", ToastDialog);

class LocalTime extends HTMLElement {
  static format = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format;
  constructor() {
    super();
  }
  connectedCallback() {
    const time = this.querySelector("time");
    time.innerText = LocalTime.format(Date.parse(time.dateTime));
  }
}
customElements.define("local-time", LocalTime);

class YouTubeSearch extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const output = this.querySelector("output");
    this.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      let url = e.target.action;
      const query = new URLSearchParams(formData).toString();
      url = `${url}?${query}`;
      const response = await fetch(url);
      output.innerHTML = await response.text()
    });
  }
}
customElements.define("youtube-search", YouTubeSearch);
