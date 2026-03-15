export function createTagInput(onChange, initialTags = []) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tag-input-wrapper';

  let tags = [...initialTags];
  let suggestions = [];

  function render() {
    const available = suggestions.filter(s => !tags.includes(s));

    wrapper.innerHTML = `
      <div class="tag-chips">
        ${tags.map(tag => `
          <span class="tag-chip">
            ${tag}<button type="button" class="tag-chip__remove" data-tag="${tag}">×</button>
          </span>
        `).join('')}
        <input class="tag-chip-input" type="text" placeholder="${tags.length ? 'Add tag…' : 'e.g. roses, watering…'}" />
      </div>
      ${available.length > 0 ? `
        <div class="tag-suggestions">
          ${available.map(s => `<button type="button" class="tag-suggestion" data-tag="${s}">${s}</button>`).join('')}
        </div>
      ` : ''}
    `;

    const input = wrapper.querySelector('.tag-chip-input');

    input.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        addTag(input.value);
        render();
        wrapper.querySelector('.tag-chip-input').focus();
      } else if (e.key === 'Backspace' && !input.value && tags.length) {
        tags = tags.slice(0, -1);
        onChange([...tags]);
        render();
        wrapper.querySelector('.tag-chip-input').focus();
      }
    });

    // Also add tag on blur if there's text
    input.addEventListener('blur', () => {
      if (input.value.trim()) {
        addTag(input.value);
        render();
      }
    });

    wrapper.querySelectorAll('.tag-chip__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        tags = tags.filter(t => t !== btn.dataset.tag);
        onChange([...tags]);
        render();
      });
    });

    wrapper.querySelectorAll('.tag-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        addTag(btn.dataset.tag);
        render();
        wrapper.querySelector('.tag-chip-input').focus();
      });
    });
  }

  function addTag(value) {
    const tag = value.trim().toLowerCase().replace(/,+$/, '');
    if (tag && !tags.includes(tag)) {
      tags = [...tags, tag];
      onChange([...tags]);
    }
  }

  wrapper.setSuggestions = (newSuggestions) => {
    suggestions = [...newSuggestions];
    render();
  };

  render();
  return wrapper;
}
