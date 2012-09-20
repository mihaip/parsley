var shareData = {};
if (window.getSelection().rangeCount) {
  var selectionHtml = new XMLSerializer().serializeToString(window.getSelection().getRangeAt(0).cloneContents());
  if (selectionHtml) {
    shareData.snippet = selectionHtml;
  }
}

if (!shareData.snippet) {
  var metaDescriptionNode = document.querySelector('meta[name="description"]');
  if (metaDescriptionNode) {
    var description = metaDescriptionNode.getAttribute('content');
    if (description) {
      shareData.snippet = description;
    }
  }
}

chrome.extension.sendMessage(shareData);