document.querySelectorAll('[data-player]').forEach((button) => {
  const video = document.getElementById(button.dataset.player);
  const label = button.dataset.player === 'feed' ? 'feed video' : 'vertical video';
  button.addEventListener('click', async () => {
    if (video.paused) {
      document.querySelectorAll('video').forEach((other) => { if (other !== video) other.pause(); });
      try { await video.play(); } catch { button.textContent = `Retry ${label}`; }
    } else video.pause();
  });
  video.addEventListener('play', () => { button.textContent = `Pause ${label}`; });
  video.addEventListener('pause', () => { button.textContent = `Play ${label}`; });
});
