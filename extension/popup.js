var LAST_USED_TAG_KEY = 'last-used-tag';

$ = document.getElementById.bind(document);

var postingFormNode = $('posting-form');
var noteNode = $('note');
var noteMirrorNode = document.querySelector('#note-container span');
var shareContainerNode = $('share-container');
var shareCheckboxNode = $('share-checkbox');
var shareLinkNode = $('share-link');
var statusMessageNode = $('status-message');
var statusSubMessageNode = $('status-sub-message');
var tagListNode = $('tag-list');
var starCheckboxNode = $('star-checkbox');
var shareData;

// Make pressing escape close the popup.
document.body.addEventListener('keypress', function(event) {
  if (event.keyCode == 96) {
    closePopup();
  }
});

var closingElements = document.querySelectorAll('.close');
for (var i = 0, closingEl; closingEl = closingElements[i]; i++) {
  closingEl.addEventListener('click', closePopup);
  // For <span>s and <div>s with a tabindex, pressing space or enter does
  // not trigger their onclick handler (http://crbug.com/122652), so we have to
  // do it manually.
  closingEl.addEventListener('keypress', function(event) {
    if (event.keyCode == 32 || event.keyCode == 13) {
      closePopup();
    }
  });
}

// Mirror the contents of the text area so that the container node is as big
// as the text's height, which in turn makes the textarea's height be as big as
// its contents. For more details, see
// http://www.alistapart.com/articles/expanding-text-areas-made-elegant/
noteNode.addEventListener('input', function() {
 noteMirrorNode.textContent = noteNode.value;
});
noteMirrorNode.textContent = noteNode.value;

getActionToken(function(actionToken) {
  getTagList(function(tagList) {
    chrome.storage.sync.get(LAST_USED_TAG_KEY, function(storageData) {
      var lastUsedTag = storageData[LAST_USED_TAG_KEY];

      tagList.forEach(function(tag) {
        var tagOptionNode = document.createElement('option');
        tagOptionNode.value = tag;
        tagOptionNode.textContent = tag;
        if (tag == lastUsedTag) {
          tagOptionNode.selected = true;
        }
        tagListNode.appendChild(tagOptionNode);
      });

      postingFormNode.onsubmit = handleFormSubmit.bind(this, actionToken);
    });
  });
});

getShareData(function(loadedShareData) {
  if (!loadedShareData || !loadedShareData.url) {
    shareContainerNode.style.display = 'none';
    return;
  }
  shareData = loadedShareData;
  shareCheckboxNode.checked = true;
  shareLinkNode.href = shareData.url;
  if (shareData.title.length > 35) {
    shareLinkNode.innerText = shareData.title.substring(0, 35) + '…';
  } else {
    shareLinkNode.innerText = shareData.title;
  }
});

function handleFormSubmit(actionToken, event) {
  var storageData = {};
  storageData[LAST_USED_TAG_KEY] = tagListNode.value;
  chrome.storage.sync.set(storageData);

  event.preventDefault();

  var params = '';
  function addParam(name, value) {
    if (params) {
      params += '&';
    }
    params += encodeURIComponent(name) + '=' + encodeURIComponent(value);
  }

  addParam('T', actionToken);
  addParam('annotation', noteNode.value);
  addParam('share', false);
  addParam('tags', 'user/-/label/' + tagListNode.value);
  if (starCheckboxNode.checked) {
    addParam('tags', 'user/-/state/com.google/starred');
  }
  if (shareCheckboxNode.checked) {
    addParam('title', shareData.title);
    addParam('url', shareData.url);
    if (shareData.snippet) {
      addParam('snippet', shareData.snippet);
    }
    if (shareData.srcTitle) {
      addParam('srcTitle', shareData.srcTitle);
    }
  }

  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    if (xhr.status != 200) {
      handleGoogleReaderApiFailure(xhr);
      return;
    }
    setStatus('Hooray! Sent to Google Reader!');
    setTimeout(function() {window.close()}, 1000);
  };
  xhr.onerror = handleGoogleReaderApiFailure.bind(this, xhr);

  xhr.open(
      'POST',
      'https://www.google.com/reader/api/0/item/edit',
      true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send(params);
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
      getGenericShareData(tab, callback, {url: tab.url, title: tab.title});
    }
  }
}

function getReaderShareData(tab, callback) {
  chrome.extension.onMessage.addListener(
      function readerMessageListener(request, sender, sendResponse) {
        // Titles from Google Reader are HTML encoded.
        var tempNode = document.createElement('div');
        tempNode.innerHTML = request.title;
        request.title = tempNode.textContent;
        callback(request);
        chrome.extension.onMessage.removeListener(readerMessageListener);
      });
  chrome.tabs.executeScript(
      tab.id, {runAt: 'document_start', file: 'reader-share-data.js'});
}

function getGenericShareData(tab, callback, shareData) {
  chrome.extension.onMessage.addListener(
      function genericMessageListener(request, sender, sendResponse) {
        for (var key in request) {
          shareData[key] = request[key];
        }
        callback(shareData);
        chrome.extension.onMessage.removeListener(genericMessageListener);
      });
  chrome.tabs.executeScript(
      tab.id, {runAt: 'document_start', file: 'generic-share-data.js'});
}


function closePopup() {
  window.close();
}

function getActionToken(callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    if (xhr.status == 200) {
      callback(xhr.responseText.trim());
      return;
    }

    setStatus('Not logged into Google Reader',
      'Oopsie, looks like you need to be logged into Google Reader before you can send links with Parsley.');
    var closeButton = document.querySelector('#status .close');
    closeButton.textContent = 'Login';
    closeButton.removeEventListener('click', closePopup);
    closeButton.addEventListener('click', function() {
      window.open('https://reader.google.com');
    });
  };
  xhr.onerror = handleGoogleReaderApiFailure.bind(this, xhr);
  xhr.open('GET', 'https://www.google.com/reader/api/0/token', true);
  xhr.send();
}

var TAG_RE = /user\/\d+\/label\/(.+)/;

function getTagList(callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    if (xhr.status != 200) {
      handleGoogleReaderApiFailure(xhr);
      return;
    }

    var responseJson = JSON.parse(xhr.responseText);
    var tags = [];
    responseJson.tags.forEach(function(tag) {
      var match = TAG_RE.exec(tag.id);
      if (match) {
        tags.push(match[1]);
      }
    });
    callback(tags);
  };
  xhr.onerror = handleGoogleReaderApiFailure.bind(this, xhr);
  xhr.open('GET', 'https://www.google.com/reader/api/0/tag/list?output=json', true);
  xhr.send();
}

function handleGoogleReaderApiFailure(xhr) {
  setStatus('Google Reader API error: ' + xhr.status, xhr.responseText);
}

function setStatus(message, opt_subMessage) {
  statusMessageNode.textContent = message;
  if (opt_subMessage) statusSubMessageNode.textContent = opt_subMessage;
  document.body.className = 'has-status';
}
