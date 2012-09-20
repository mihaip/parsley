var shareData = {};
if (window.getSelection().rangeCount) {
  var selectionHtml = new XMLSerializer().serializeToString(window.getSelection().getRangeAt(0).cloneContents());
  if (selectionHtml) {
    shareData.snippet = selectionHtml;
  }
}

chrome.extension.sendMessage(shareData);