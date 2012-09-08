$ = document.getElementById.bind(document);

var postingFormNode = $('posting-form');
var noteNode = $('note');
var shareContainerNode = $('share-container');
var shareCheckboxNode = $('share-checkbox');
var shareLinkNode = $('share-link');
var statusNode = $('status');
var shareData;

postingFormNode.onsubmit = handleFormSubmit;

getShareData(function(loadedShareData) {
  if (!loadedShareData || !loadedShareData.url) {
    shareContainerNode.style.display = 'none';
    return;
  }
  shareData = loadedShareData;
  shareCheckboxNode.checked = true;
  shareLinkNode.href = shareData.url;
  if (shareData.title.length > 30) {
    shareLinkNode.innerText = shareData.title.substring(0, 30) + '…';
  } else {
    shareLinkNode.innerText = shareData.title;
  }
});

function handleFormSubmit(event) {
  event.preventDefault();

  var note = noteNode.value;

  if (shareCheckboxNode.checked) {
    note += '\n' + shareData.title + ' - ' + shareData.url;
  }

  getSignature(function(signature) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      setStatus('Sent!');
      setTimeout(function() {window.close()}, 1000);
    };
    xhr.onerror = function() {
      setStatus('Failure: ' + xhr.responseText);
    };

    xhr.open(
        'POST',
        'https://avocado.io/api/conversation?avosig=' + encodeURIComponent(signature),
        true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.send('message=' + encodeURIComponent(note));
  });
}

function getShareData(callback) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs) {
    var tab = tabs[0];
    // During development, the popup is in its own tab, so we use the first
    // tab in the window instead.
    if (tab.url == location.href) {
      chrome.tabs.query({currentWindow: true}, function (tabs) {
        continueWithTab(tabs[0]);
      });
    } else {
      continueWithTab(tab);
    }
  });

  function continueWithTab(tab) {
    if (tab.url.indexOf('http://www.google.com/reader/') == 0 ||
        tab.url.indexOf('https://www.google.com/reader/') == 0) {
      getReaderShareData(tab, callback);
    } else {
      callback({url: tab.url, title: tab.title});
    }
  }
}

function getReaderShareData(tab, callback) {
  chrome.extension.onMessage.addListener(
      function readerMessageListener(request, sender, sendResponse) {
        callback(request);
        chrome.extension.onMessage.removeListener(readerMessageListener);
      });
  chrome.tabs.executeScript(
      tab.id, {runAt: 'document_start', file: 'reader-share-data.js'});
}

var SIGNATURE_RE = /var\s+apiSignature\s+=\s+"(.+)";/m;

function getSignature(callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    var match = SIGNATURE_RE.exec(xhr.responseText);
    if (!match) {
      setStatus('Couldn\'t find Avocado signature.');
      return;
    }

    callback(match[1]);
  };
  xhr.onerror = function() {
    setStatus('Avocado signature XHR error.' + xhr.responseText);
  };
  xhr.open('GET', 'https://avocado.io/=/', true);
  xhr.send();
}

function setStatus(message) {
  statusNode.textContent = message;
}