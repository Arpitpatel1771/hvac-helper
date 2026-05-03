/**
 * DOM updates for all panels: toolbar state, shape list, screen switching.
 * No Konva here — this file only touches HTML elements.
 */

import { state } from './state.js';

// ── Screen switching ───────────────────────────────────────────────────────────

export function showApp(filename) {
  document.getElementById('uploader-screen').classList.add('hidden');
  const appScreen = document.getElementById('app-screen');
  appScreen.classList.remove('hidden');
  appScreen.classList.add('flex');
  document.getElementById('filename-display').textContent = filename;
}

export function showUploader() {
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('flex');
  document.getElementById('uploader-screen').classList.remove('hidden');
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

/**
 * Highlights the active tool button and updates page/zoom counters.
 */
export function updateToolbar() {
  // Tool buttons
  const tools = ['select', 'rect', 'polygon'];
  for (const t of tools) {
    const btn = document.getElementById(`tool-${t}`);
    if (!btn) continue;
    if (t === state.tool) {
      btn.classList.add('bg-blue-100', 'text-blue-600');
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('bg-blue-100', 'text-blue-600');
      btn.classList.add('text-slate-400');
    }
  }

  // Page navigation
  document.getElementById('page-display').textContent =
    `${state.currentPage} / ${state.totalPages}`;
  document.getElementById('page-prev').disabled = state.currentPage <= 1;
  document.getElementById('page-next').disabled = state.currentPage >= state.totalPages;

  // Zoom
  document.getElementById('zoom-display').textContent =
    `${Math.round(state.zoom * 100)}%`;
  document.getElementById('zoom-in').disabled  = state.zoom >= 3;
  document.getElementById('zoom-out').disabled = state.zoom <= 0.25;
}

// ── Shape list ─────────────────────────────────────────────────────────────────

/**
 * Rebuilds the shape list in the sidebar.
 * @param {function} onDelete  - called with shape id when delete is clicked
 * @param {function} onSelect  - called with shape id when a row is clicked
 * @param {function} onRename  - called with (id, newName) when name is changed
 */
export function renderShapeList(onDelete, onSelect, onRename) {
  const list = document.getElementById('shape-list');
  const pageShapes = state.shapes.filter(s => s.page === state.currentPage);

  if (pageShapes.length === 0) {
    list.innerHTML = `
      <li class="text-xs text-slate-400 text-center py-8 px-4">
        No zones on this page yet.<br>Pick a draw tool and start drawing.
      </li>`;
    return;
  }

  list.innerHTML = pageShapes.map(s => {
    const isSelected = s.id === state.selectedId;
    const bg = isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50';
    return `
      <li data-id="${s.id}"
          class="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${bg}">
        <div class="w-3 h-3 rounded-sm flex-shrink-0" style="background:${s.color}"></div>
        <input
          type="text"
          value="${escapeHtml(s.name)}"
          data-id="${s.id}"
          class="shape-name flex-1 text-sm bg-transparent border-none outline-none
                 focus:bg-white focus:ring-1 focus:ring-blue-300 rounded px-1 cursor-pointer"
        />
        <button
          data-id="${s.id}"
          class="delete-btn p-1 text-slate-300 hover:text-red-500 rounded flex-shrink-0 transition-colors"
          title="Delete zone"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </li>`;
  }).join('');

  // Wire up events on the generated elements
  list.querySelectorAll('li[data-id]').forEach(li => {
    li.addEventListener('click', (e) => {
      // Don't trigger row click when clicking the input or delete button
      if (e.target.closest('.delete-btn') || e.target.tagName === 'INPUT') return;
      onSelect(li.dataset.id);
    });
  });

  list.querySelectorAll('.shape-name').forEach(input => {
    // Save name on blur or Enter
    const save = () => onRename(input.dataset.id, input.value.trim() || 'Zone');
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  });

  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(btn.dataset.id);
    });
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
