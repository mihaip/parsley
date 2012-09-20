// We can't see the getPermalink() function (since it's in the main world) but
// we can run it via a javascript: URL. We can get at its return value via an
// message listener (at least until http://crbug.com/87520 is fixed).

var shareData = {};
var currentItemBody = document.querySelector('#current-entry .item-body');
if (currentItemBody) {
  shareData.snippet = currentItemBody.firstChild.innerHTML;
}
var currentItemSourceTitle = document.querySelector('#current-entry .entry-source-title');
if (currentItemSourceTitle) {
  shareData.srcTitle = currentItemSourceTitle.textContent;
}

window.addEventListener('message', function readerMessageListener(message) {
  if (message.data) {
    shareData.title = message.data.title;
    shareData.url = message.data.url;
  } else {
    shareData = {};
  }
  chrome.extension.sendMessage(shareData);
  window.removeEventListener('message', readerMessageListener);
});

window.location.href = 'javascript:postMessage(getPermalink(), location.href)';

