// Loads the game on computers, or the leaderboard-only page on phones and tablets.
// If a computer's browser can't run the 3D game, it falls back to that page with a note.
if (window.__isMobile) {
  import('./mobile.js').then(m => m.show('mobile'));
  // the 3D arena behind it; if the phone can't do 3D, the plain gradient stays
  import('./backdrop.js').then(b => b.start()).catch(err => console.warn('No 3D backdrop:', err));
} else {
  import('./main.js').catch(err => {
    console.error(err);
    document.documentElement.classList.add('mobile');
    import('./mobile.js').then(m => m.show('nogame'));
  });
}
