import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVoiceRecorder } from '../components/voice-recorder.js';

// Helper to build a minimal SpeechRecognition mock
function makeSpeechRecognitionMock() {
  return class MockSpeechRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = '';
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }
    start = vi.fn();
    stop = vi.fn();

    // Simulate receiving a transcript result
    simulateResult(finals = [], interim = '') {
      if (!this.onresult) return;
      const results = [
        ...finals.map(text => Object.assign([{ transcript: text }], { isFinal: true })),
        ...(interim ? [Object.assign([{ transcript: interim }], { isFinal: false })] : []),
      ];
      // Add isFinal prop to each result
      const event = {
        results: results.map((r, i) => {
          const res = [{ transcript: r[0].transcript }];
          res.isFinal = r.isFinal;
          return res;
        }),
      };
      this.onresult(event);
    }
  };
}

beforeEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createVoiceRecorder — unsupported browser', () => {
  it('renders an unsupported message when SpeechRecognition is unavailable', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    expect(wrapper.querySelector('.voice-unsupported')).not.toBeNull();
  });

  it('does not render the mic button when unsupported', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    expect(wrapper.querySelector('#btn-mic')).toBeNull();
  });
});

describe('createVoiceRecorder — supported browser', () => {
  let MockSpeechRecognition;
  let lastInstance;

  beforeEach(() => {
    MockSpeechRecognition = makeSpeechRecognitionMock();
    // Intercept construction so we can reference the instance
    window.SpeechRecognition = new Proxy(MockSpeechRecognition, {
      construct(Target, args) {
        lastInstance = new Target(...args);
        return lastInstance;
      },
    });
  });

  it('renders the mic button', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    expect(wrapper.querySelector('#btn-mic')).not.toBeNull();
  });

  it('hides the transcript textarea initially', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    const textarea = wrapper.querySelector('#voice-transcript');
    expect(textarea.style.display).toBe('none');
  });

  it('starts recording when mic button is clicked', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    wrapper.querySelector('#btn-mic').click();

    expect(lastInstance.start).toHaveBeenCalled();
    expect(wrapper.querySelector('#btn-mic').classList.contains('recording')).toBe(true);
    expect(wrapper.querySelector('#mic-label').textContent).toBe('Stop recording');
  });

  it('shows the textarea when recording starts', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    wrapper.querySelector('#btn-mic').click();
    expect(wrapper.querySelector('#voice-transcript').style.display).not.toBe('none');
  });

  it('stops recording when mic button is clicked a second time', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    const btn = wrapper.querySelector('#btn-mic');
    btn.click(); // start
    btn.click(); // stop

    expect(lastInstance.stop).toHaveBeenCalled();
    expect(btn.classList.contains('recording')).toBe(false);
    expect(wrapper.querySelector('#mic-label').textContent).toBe('Record voice note');
  });

  it('configures recognition with correct settings', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    wrapper.querySelector('#btn-mic').click();

    expect(lastInstance.continuous).toBe(true);
    expect(lastInstance.interimResults).toBe(true);
    expect(lastInstance.lang).toBe('en-GB');
  });

  it('calls onTranscript with combined transcript text during recognition', () => {
    const onTranscript = vi.fn();
    const wrapper = createVoiceRecorder(onTranscript);
    wrapper.querySelector('#btn-mic').click();

    // Simulate one final result
    lastInstance.onresult({
      results: Object.assign(
        [Object.assign([{ transcript: 'hello world' }], { isFinal: true })],
        {}
      ),
    });

    expect(onTranscript).toHaveBeenCalled();
    const lastCall = onTranscript.mock.calls.at(-1)[0];
    expect(lastCall).toContain('hello world');
  });

  it('displays the transcript in the textarea during recognition', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    wrapper.querySelector('#btn-mic').click();

    lastInstance.onresult({
      results: [Object.assign([{ transcript: 'my garden note' }], { isFinal: true })],
    });

    expect(wrapper.querySelector('#voice-transcript').value).toContain('my garden note');
  });

  it('carries over committed text when recognition auto-restarts', () => {
    const onTranscript = vi.fn();
    const wrapper = createVoiceRecorder(onTranscript);
    wrapper.querySelector('#btn-mic').click();

    // First session: one final result
    lastInstance.onresult({
      results: [Object.assign([{ transcript: 'first sentence. ' }], { isFinal: true })],
    });
    // Session ends (e.g. silence) — recorder auto-restarts
    lastInstance.onend();

    // Second session: another final result
    lastInstance.onresult({
      results: [Object.assign([{ transcript: 'second sentence.' }], { isFinal: true })],
    });

    const transcript = wrapper.querySelector('#voice-transcript').value;
    expect(transcript).toContain('first sentence.');
    expect(transcript).toContain('second sentence.');
  });

  it('makes the textarea editable after stopping', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    const btn = wrapper.querySelector('#btn-mic');
    btn.click();
    // Textarea is readOnly while recording
    expect(wrapper.querySelector('#voice-transcript').readOnly).toBe(true);
    btn.click(); // stop
    expect(wrapper.querySelector('#voice-transcript').readOnly).toBe(false);
  });

  it('preserves manually edited text when recording starts again', () => {
    const onTranscript = vi.fn();
    const wrapper = createVoiceRecorder(onTranscript);
    const btn = wrapper.querySelector('#btn-mic');
    const textarea = wrapper.querySelector('#voice-transcript');

    // Start, get some transcript, stop
    btn.click();
    lastInstance.onresult({
      results: [Object.assign([{ transcript: 'auto transcript ' }], { isFinal: true })],
    });
    btn.click(); // stop

    // User manually edits
    textarea.value = 'manually edited text ';
    textarea.dispatchEvent(new Event('input'));

    // Start recording again
    btn.click();
    // New recognition result comes in
    lastInstance.onresult({
      results: [Object.assign([{ transcript: 'new words' }], { isFinal: true })],
    });

    expect(textarea.value).toContain('manually edited text ');
    expect(textarea.value).toContain('new words');
  });

  it('stops recording and shows permission denied message on not-allowed error', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    wrapper.querySelector('#btn-mic').click();

    lastInstance.onerror({ error: 'not-allowed' });

    expect(wrapper.querySelector('#btn-mic').classList.contains('recording')).toBe(false);
    expect(wrapper.querySelector('#voice-transcript').value).toBe('Microphone permission denied.');
  });
});
