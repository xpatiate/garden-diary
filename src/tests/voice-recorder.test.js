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

  // Helper to build a realistic onresult event as Chrome fires it:
  // resultIndex points to the first new/changed result; earlier results are
  // already committed from previous events and must not be reprocessed.
  function makeResultEvent(results, resultIndex = 0) {
    return {
      resultIndex,
      results: results.map(({ transcript, isFinal }) => {
        const r = [{ transcript }];
        r.isFinal = isFinal;
        return r;
      }),
    };
  }

  it('calls onTranscript with combined transcript text during recognition', () => {
    const onTranscript = vi.fn();
    const wrapper = createVoiceRecorder(onTranscript);
    wrapper.querySelector('#btn-mic').click();

    lastInstance.onresult(makeResultEvent([{ transcript: 'hello world', isFinal: true }]));

    expect(onTranscript).toHaveBeenCalled();
    const lastCall = onTranscript.mock.calls.at(-1)[0];
    expect(lastCall).toContain('hello world');
  });

  it('displays the transcript in the textarea during recognition', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    wrapper.querySelector('#btn-mic').click();

    lastInstance.onresult(makeResultEvent([{ transcript: 'my garden note', isFinal: true }]));

    expect(wrapper.querySelector('#voice-transcript').value).toContain('my garden note');
  });

  // Regression: Chrome on Android sends the full utterance in every result entry,
  // growing over time, e.g.: [{F:""}, {F:"testing"}, {F:"testing the"}, ...]
  // The last entry is always the most complete. Earlier approaches that summed
  // all finals produced the concatenated mess the user saw ("testingtesting thetesting the voice").
  // The fix: assign committed = last result's transcript (not accumulate).
  it('does not duplicate text when Chrome grows the utterance across result entries', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    wrapper.querySelector('#btn-mic').click();
    const textarea = wrapper.querySelector('#voice-transcript');

    // Each event adds a new entry; the last entry has the full utterance so far
    lastInstance.onresult(makeResultEvent([
      { transcript: '', isFinal: true },
      { transcript: 'testing', isFinal: true },
    ], 1));
    expect(textarea.value).toBe('testing');

    lastInstance.onresult(makeResultEvent([
      { transcript: '', isFinal: true },
      { transcript: 'testing', isFinal: true },
      { transcript: 'testing the', isFinal: true },
    ], 2));
    expect(textarea.value).toBe('testing the');

    lastInstance.onresult(makeResultEvent([
      { transcript: '', isFinal: true },
      { transcript: 'testing', isFinal: true },
      { transcript: 'testing the', isFinal: true },
      { transcript: 'testing the voice transcription', isFinal: true },
    ], 3));
    expect(textarea.value).toBe('testing the voice transcription');
  });

  // Regression test: demonstrates the within-session concatenation bug.
  //
  // On Android Chrome, setting textarea.value programmatically can fire an
  // 'input' event when the element has focus. Without the isRecording guard,
  // each onresult event would:
  //   1. set textarea.value = "this"
  //   2. trigger 'input' → savedText = "this", committed = ""
  //   3. next onresult: committed = "this", interim = " is"
  //      → full = "this" + "this" + " is" = "thisthisthis is"
  //
  // resulting in: "thisthisthis isthis is whatthis is what..."
  it('does not concatenate when input event fires during recording', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    wrapper.querySelector('#btn-mic').click();
    const textarea = wrapper.querySelector('#voice-transcript');

    // Simulate Chrome firing 'input' after each programmatic value change
    function fireInput() { textarea.dispatchEvent(new Event('input')); }

    lastInstance.onresult(makeResultEvent([{ transcript: 'this ', isFinal: false }]));
    fireInput(); // Android Chrome spurious input event

    lastInstance.onresult(makeResultEvent([{ transcript: 'this is ', isFinal: false }]));
    fireInput();

    lastInstance.onresult(makeResultEvent([{ transcript: 'this is what the text looks like', isFinal: true }]));
    fireInput();

    expect(textarea.value).toBe('this is what the text looks like');
  });

  it('stops recording automatically when the recognition session ends', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    const btn = wrapper.querySelector('#btn-mic');
    btn.click(); // start

    expect(btn.classList.contains('recording')).toBe(true);

    lastInstance.onend(); // browser fires onend (e.g. silence detected)

    expect(btn.classList.contains('recording')).toBe(false);
    expect(wrapper.querySelector('#mic-label').textContent).toBe('Record voice note');
    expect(wrapper.querySelector('#voice-transcript').readOnly).toBe(false);
  });

  it('locks in committed finals when recognition session ends', () => {
    const onTranscript = vi.fn();
    const wrapper = createVoiceRecorder(onTranscript);
    wrapper.querySelector('#btn-mic').click();

    lastInstance.onresult(makeResultEvent([{ transcript: 'hello garden', isFinal: true }]));
    lastInstance.onend();

    expect(wrapper.querySelector('#voice-transcript').value).toBe('hello garden');
  });

  // Regression test: demonstrates the concatenation bug that existed before the fix.
  //
  // The old code auto-restarted on onend. Chrome's Web Speech API restarts
  // frequently (often after 1-2 words) and the new session re-recognises
  // overlapping audio from the tail of the last session. For example, saying
  // "this is what the text looks like" could produce many onend/restart cycles,
  // each adding a duplicate of the overlapping region to savedText:
  //
  //   savedText="this" + new session interim "this is" → "thisthisthis is"
  //   savedText="thisthisthis is" + new session interim "this is what" → ...
  //
  // resulting in: "thisthisthis isthis is whatthis is what..."
  //
  // With the fix, onend stops recording instead of restarting, so no new
  // session begins and there is nothing to cause duplication.
  it('does not duplicate text when the recognition session ends mid-utterance', () => {
    const wrapper = createVoiceRecorder(vi.fn());
    wrapper.querySelector('#btn-mic').click();

    // Session finalises the first word, then ends before the rest is recognised
    lastInstance.onresult(makeResultEvent([{ transcript: 'this ', isFinal: true }]));
    lastInstance.onend();

    // Old behaviour: a new session would start, re-recognise overlapping audio,
    // and deliver e.g. "this is what the text looks like" as a new interim,
    // producing "this this is what the text looks like" (and worse on further restarts).
    //
    // New behaviour: recording has stopped, transcript contains only what was
    // captured in the single session.
    expect(wrapper.querySelector('#voice-transcript').value).toBe('this ');
    // No new recognition session was started
    expect(lastInstance.start).toHaveBeenCalledTimes(1);
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
    lastInstance.onresult(makeResultEvent([{ transcript: 'auto transcript ', isFinal: true }]));
    btn.click(); // stop

    // User manually edits
    textarea.value = 'manually edited text ';
    textarea.dispatchEvent(new Event('input'));

    // Start recording again
    btn.click();
    // New recognition result comes in
    lastInstance.onresult(makeResultEvent([{ transcript: 'new words', isFinal: true }]));

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
