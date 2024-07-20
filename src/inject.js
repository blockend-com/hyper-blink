function injectScript(file) {
  const script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', chrome.runtime.getURL(file));
  document.body.appendChild(script);
}

injectScript('pageScript.js');
