'use strict';

function loadPopupController() {
  const script = document.createElement('script');
  script.src = 'popup.js';
  script.defer = true;
  document.head.appendChild(script);
}

requestAnimationFrame(() => setTimeout(loadPopupController, 0));
