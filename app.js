document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.tool-card');
  
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const url = card.getAttribute('data-url');
      if (url) {
        // Add glitch transition effect
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
          window.location.href = url;
        }, 150);
      }
    });
    
    // Add hover sound effect (optional)
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
  });
  
  // Matrix rain effect on background (optional enhancement)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '0';
  canvas.style.opacity = '0.05';
  
  document.body.appendChild(canvas);
  
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  
  const cols = Math.floor(width / 20);
  const ypos = Array(cols).fill(0);
  
  function matrix() {
    ctx.fillStyle = '#0001';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#0f0';
    ctx.font = '15px monospace';
    
    ypos.forEach((y, ind) => {
      const text = String.fromCharCode(Math.random() * 128);
      const x = ind * 20;
      ctx.fillText(text, x, y);
      
      if (y > 100 + Math.random() * 10000) ypos[ind] = 0;
      else ypos[ind] = y + 20;
    });
  }
  
  setInterval(matrix, 50);
  
  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });
});
