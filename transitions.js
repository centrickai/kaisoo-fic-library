
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener("click", event => {
      const url = new URL(link.href, location.href);

      if (
        url.origin !== location.origin ||
        !url.pathname.toLowerCase().endsWith(".html") ||
        url.pathname === location.pathname ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      event.preventDefault();

      document.body.classList.add("page-leaving");

      setTimeout(() => {
        window.location.href = url.href;
      }, 220);
    });
  });
});
