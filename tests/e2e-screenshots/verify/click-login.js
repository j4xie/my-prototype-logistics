// Find the login button (white text on green bg, not the page title)
var allDivs = document.querySelectorAll('div[dir="auto"]');
var loginBtn = null;
for (var i = 0; i < allDivs.length; i++) {
  if (allDivs[i].textContent === '\u767B\u5F55') {
    var style = getComputedStyle(allDivs[i]);
    if (style.color === 'rgb(255, 255, 255)' && allDivs[i].getBoundingClientRect().top > 300) {
      loginBtn = allDivs[i];
      break;
    }
  }
}
if (loginBtn) {
  // Walk up to find the TouchableOpacity (clickable parent)
  var parent = loginBtn.parentElement;
  // Dispatch full touch/pointer event sequence for React Native Web
  var rect = parent.getBoundingClientRect();
  var cx = rect.left + rect.width / 2;
  var cy = rect.top + rect.height / 2;
  parent.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: cx, clientY: cy}));
  parent.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: cx, clientY: cy}));
  parent.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: cx, clientY: cy}));
  parent.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: cx, clientY: cy}));
  parent.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: cx, clientY: cy}));
  'clicked at ' + cx + ',' + cy;
} else {
  'login button not found';
}
