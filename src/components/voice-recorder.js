export function createVoiceRecorder(onTranscript) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const wrapper = document.createElement('div');
  wrapper.className = 'voice-recorder';

  if (!SpeechRecognition) {
    wrapper.innerHTML = `<p class="voice-unsupported">Voice recording not supported in this browser.</p>`;
    return wrapper;
  }

  let recognition = null;
  let isRecording = false;
  let savedText = '';  // text from completed sessions
  let committed = ''; // final results in current session

  wrapper.innerHTML = `
    <button type="button" class="btn btn--voice" id="btn-mic">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
      <span id="mic-label">Record voice note</span>
    </button>
    <textarea class="input textarea voice-transcript" id="voice-transcript" rows="4" placeholder="Transcript will appear here…" style="display:none"></textarea>
  `;

  const micBtn = wrapper.querySelector('#btn-mic');
  const micLabel = wrapper.querySelector('#mic-label');
  const transcriptEl = wrapper.querySelector('#voice-transcript');

  transcriptEl.addEventListener('input', () => {
    savedText = transcriptEl.value;
    committed = '';
    onTranscript(transcriptEl.value);
  });

  function startRecognition() {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    recognition.onresult = (event) => {
      let interim = '';
      let finals = '';
      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finals += text;
        else interim += text;
      }
      committed = finals; // assign, not accumulate — avoids re-processing old finals
      const full = savedText + committed + interim;
      transcriptEl.value = full;
      onTranscript(full);
    };

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') {
        stopRecording();
        transcriptEl.value = 'Microphone permission denied.';
        transcriptEl.style.display = '';
      }
      // 'no-speech' and others are handled by onend auto-restart
    };

    recognition.onend = () => {
      if (isRecording) {
        savedText += committed; // carry over finals from this session
        committed = '';
        startRecognition();
      }
    };

    recognition.start();
  }

  function stopRecording() {
    isRecording = false;
    if (recognition) recognition.stop();
    micBtn.classList.remove('recording');
    micLabel.textContent = 'Record voice note';
    transcriptEl.readOnly = false;
    if (transcriptEl.value) transcriptEl.style.display = '';
  }

  micBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      isRecording = true;
      savedText = transcriptEl.value; // preserve any prior edits
      committed = '';
      micBtn.classList.add('recording');
      micLabel.textContent = 'Stop recording';
      transcriptEl.readOnly = true;
      transcriptEl.style.display = '';
      startRecognition();
    }
  });

  return wrapper;
}
