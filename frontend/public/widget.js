(function () {
  var scriptEl = document.currentScript;
  var channel = scriptEl.getAttribute('data-channel');
  if (!channel) {
    console.warn('[helpdesk-widget] Brak atrybutu data-channel na tagu <script>.');
    return;
  }

  var baseUrl = scriptEl.src.replace(/\/widget\.js.*$/, '');
  var open = false;

  var bubble = document.createElement('button');
  bubble.setAttribute('aria-label', 'Czat');
  bubble.style.cssText = [
    'position:fixed', 'bottom:20px', 'right:20px', 'width:56px', 'height:56px',
    'border-radius:50%', 'background:#1d4ed8', 'color:#fff', 'border:none',
    'font-size:24px', 'cursor:pointer', 'box-shadow:0 2px 10px rgba(0,0,0,0.25)',
    'z-index:999999',
  ].join(';');
  bubble.textContent = '💬';

  var iframe = document.createElement('iframe');
  iframe.src = baseUrl + '/chat/' + encodeURIComponent(channel);
  iframe.style.cssText = [
    'position:fixed', 'bottom:88px', 'right:20px', 'width:360px', 'height:520px',
    'max-height:80vh', 'border:none', 'border-radius:12px',
    'box-shadow:0 4px 24px rgba(0,0,0,0.3)', 'z-index:999999', 'display:none',
    'background:#fff',
  ].join(';');
  iframe.title = 'Czat z obsługą';

  bubble.addEventListener('click', function () {
    open = !open;
    iframe.style.display = open ? 'block' : 'none';
    bubble.textContent = open ? '✕' : '💬';
  });

  document.body.appendChild(iframe);
  document.body.appendChild(bubble);
})();
