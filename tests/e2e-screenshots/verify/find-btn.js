var all = document.querySelectorAll('div');
var result = [];
for (var i = 0; i < all.length; i++) {
  var el = all[i];
  if (el.textContent.trim() === '\u767B\u5F55') {
    var r = el.getBoundingClientRect();
    var bg = getComputedStyle(el).backgroundColor;
    if (bg !== 'rgba(0, 0, 0, 0)') {
      result.push({bg: bg, top: r.top, left: r.left, w: r.width, h: r.height});
    }
  }
}
JSON.stringify(result);
