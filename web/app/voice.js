// "Mock voice": the browser's own speech, no service. Replies are read aloud with speechSynthesis
// (works offline with the operating system's voices). The mic uses the Web Speech API's
// recognizer where the browser has one; note that Chrome and Edge recognize speech on a server, so
// in a disconnected hangar the mic falls back to typing and only the read-aloud half is offline.

export function canSpeak() {
  return typeof speechSynthesis !== 'undefined';
}

export function speak(text) {
  if (!canSpeak() || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.03;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
}

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function canListen() {
  return !!Recognition;
}

/** One utterance from the mic. Resolves with the transcript ('' when nothing was heard). */
export function listenOnce() {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('speech recognition is not available in this browser'));
    const r = new Recognition();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    let heard = '';
    r.onresult = (e) => (heard = e.results[0][0].transcript);
    r.onerror = (e) => reject(new Error(`speech recognition: ${e.error}`));
    r.onend = () => resolve(heard);
    r.start();
  });
}
