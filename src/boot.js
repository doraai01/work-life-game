// Boot loader for GitHub Pages with CSP-friendly setup
const overlay = document.getElementById('overlay');

function escapeHTML(s){
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function show(msg){
  overlay.innerHTML = '<div style="text-align:center; padding:24px; background:rgba(0,0,0,0.35); border-radius:12px; max-width:560px;">'+msg+'</div>';
  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'auto';
}

if (location.protocol === 'file:') {
  show('このページはローカルファイルとして開くと表示されません。<br>簡易サーバーで <code>http://localhost</code> から開いてください。<br><br><b>例:</b> ターミナルでリポジトリ直下に移動して<br><code>python3 -m http.server 8000</code><br>を実行し、<code>http://localhost:8000/</code> を開いてください。');
} else {
  // Load the main module dynamically when served over http(s)
  // Try ./src (for GitHub Pages site root) then ../src (for local /public/ serving)
  const candidates = [
    new URL('./src/main.js', location.href).toString(),
    new URL('../src/main.js', location.href).toString()
  ];
  (async () => {
    for (const u of candidates) {
      try {
        const res = await fetch(u, { method: 'HEAD', cache: 'no-cache' });
        if (res.ok) { await import(u); return; }
      } catch {}
    }
    const msg = 'スクリプトの読み込みに失敗しました。環境設定をご確認ください。';
    show(msg);
  })();
}

window.addEventListener('error', function(e){
  const msg = String(e && e.message ? e.message : e);
  show('エラーが発生しました:<br><small>'+ escapeHTML(msg) +'</small>');
});

