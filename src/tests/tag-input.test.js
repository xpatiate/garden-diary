import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTagInput } from '../components/tag-input.js';

function getInput(wrapper) {
  return wrapper.querySelector('.tag-chip-input');
}

function getChips(wrapper) {
  return [...wrapper.querySelectorAll('.tag-chip')].map(el =>
    el.textContent.replace('×', '').trim()
  );
}

function typeAndSubmit(input, value, key = 'Enter') {
  input.value = value;
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('createTagInput', () => {
  it('renders initial tags as chips', () => {
    const wrapper = createTagInput(vi.fn(), ['roses', 'watering']);
    expect(getChips(wrapper)).toEqual(['roses', 'watering']);
  });

  it('adds a tag on Enter and notifies onChange', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange);
    typeAndSubmit(getInput(wrapper), 'tomatoes');

    expect(getChips(wrapper)).toContain('tomatoes');
    expect(onChange).toHaveBeenCalledWith(['tomatoes']);
  });

  it('adds a tag on comma key', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange);
    typeAndSubmit(getInput(wrapper), 'basil', ',');

    expect(getChips(wrapper)).toContain('basil');
    expect(onChange).toHaveBeenCalledWith(['basil']);
  });

  it('adds a tag on blur if input has text', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange);
    const input = getInput(wrapper);
    input.value = 'mint';
    input.dispatchEvent(new Event('blur'));

    expect(getChips(wrapper)).toContain('mint');
    expect(onChange).toHaveBeenCalledWith(['mint']);
  });

  it('lowercases and trims the tag value', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange);
    typeAndSubmit(getInput(wrapper), '  Lavender  ');

    expect(getChips(wrapper)).toContain('lavender');
    expect(onChange).toHaveBeenCalledWith(['lavender']);
  });

  it('strips trailing commas from tag value', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange);
    // Simulates typing "basil," then hitting Enter
    typeAndSubmit(getInput(wrapper), 'basil,');

    expect(getChips(wrapper)).toContain('basil');
    expect(onChange).toHaveBeenCalledWith(['basil']);
  });

  it('ignores duplicate tags', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange, ['roses']);
    typeAndSubmit(getInput(wrapper), 'roses');

    expect(getChips(wrapper)).toEqual(['roses']);
    // onChange not called since nothing changed
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not add an empty or whitespace-only tag', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange);
    typeAndSubmit(getInput(wrapper), '   ');

    expect(getChips(wrapper)).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a tag when its × button is clicked', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange, ['roses', 'mint']);
    const removeBtn = wrapper.querySelector('[data-tag="roses"]');
    removeBtn.click();

    expect(getChips(wrapper)).toEqual(['mint']);
    expect(onChange).toHaveBeenCalledWith(['mint']);
  });

  it('removes the last tag on Backspace when input is empty', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange, ['roses', 'mint']);
    const input = getInput(wrapper);
    input.value = '';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(getChips(wrapper)).toEqual(['roses']);
    expect(onChange).toHaveBeenCalledWith(['roses']);
  });

  it('does not remove a tag on Backspace when input has text', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange, ['roses']);
    const input = getInput(wrapper);
    input.value = 'mi';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(getChips(wrapper)).toEqual(['roses']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accumulates multiple tags correctly', () => {
    const onChange = vi.fn();
    const wrapper = createTagInput(onChange);
    typeAndSubmit(getInput(wrapper), 'roses');
    typeAndSubmit(getInput(wrapper), 'mint');

    expect(getChips(wrapper)).toEqual(['roses', 'mint']);
    expect(onChange).toHaveBeenLastCalledWith(['roses', 'mint']);
  });
});
