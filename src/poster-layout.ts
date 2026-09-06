// Both the visible poster and its export use this adjustment after fonts load.
export const fitPosterText = (poster: HTMLElement) => {
  const header = poster.querySelector<HTMLElement>(".poster-header > div");
  const title = header?.querySelector<HTMLElement>("h2");
  if (header && title) {
    let size = 38;
    title.style.fontSize = `${size}px`;
    while (header.scrollHeight > 108 && size > 16) {
      title.style.fontSize = `${--size}px`;
    }
  }
  for (const text of poster.querySelectorAll<HTMLElement>(".cell-text")) {
    const cell = text.parentElement!;
    // Keep room for a small image when a particularly long caption needs it.
    const available = cell.clientHeight - 20 - (cell.querySelector("img") ? 30 : 0);
    let size = 14;
    text.style.fontSize = `${size}px`;
    while (text.scrollHeight > available && size > 8) {
      text.style.fontSize = `${--size}px`;
    }
  }
};
