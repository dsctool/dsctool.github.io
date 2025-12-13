document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".tool-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const url = card.getAttribute("data-url");
      if (url) {
        window.location.href = url;
      }
    });
  });
});
