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
  const tools = ['select', 'rect', 'polygon', 'text'];
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

  document.getElementById('page-display').textContent =
    `${state.currentPage} / ${state.totalPages}`;
  document.getElementById('page-prev').disabled = state.currentPage <= 1;
  document.getElementById('page-next').disabled = state.currentPage >= state.totalPages;

  document.getElementById('zoom-display').textContent =
    `${Math.round(state.zoom * 100)}%`;
  document.getElementById('zoom-in').disabled  = state.zoom >= 3;
  document.getElementById('zoom-out').disabled = state.zoom <= 0.25;
}

// ── Text toolbar (second row, contextual) ──────────────────────────────────────

/**
 * Shows/hides the text formatting toolbar and updates font size display.
 * Pass the selected annotation object, or null to hide.
 */
export function updateTextToolbar(annotation) {
  const toolbar = document.getElementById('text-toolbar');
  if (!annotation) {
    toolbar.classList.add('hidden');
    return;
  }
  toolbar.classList.remove('hidden');
  document.getElementById('font-size-display').textContent = `${annotation.fontSize}px`;
}

// ── Shape list ─────────────────────────────────────────────────────────────────

/**
 * Rebuilds the shape list sidebar, with annotations nested under their linked zone.
 */
export function renderShapeList(onDelete, onSelect, onRename, onAnnotationDelete, onAnnotationSelect) {
  const list = document.getElementById('shape-list');
  const pageShapes = state.shapes.filter(s => s.page === state.currentPage);
  const pageAnnotations = state.annotations.filter(a => a.page === state.currentPage);

  if (pageShapes.length === 0 && pageAnnotations.length === 0) {
    list.innerHTML = `
      <li class="text-xs text-slate-400 text-center py-8 px-4">
        No zones on this page yet.<br>Pick a draw tool and start drawing.
      </li>`;
    return;
  }

  const items = [];

  for (const s of pageShapes) {
    const isSelected = s.id === state.selectedId;
    const bg = isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50';
    items.push(`
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
          title="Delete zone">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </li>`);

    // Annotations nested under this zone
    const linked = pageAnnotations.filter(a => a.linkedShapeId === s.id);
    for (const ann of linked) {
      items.push(annotationRow(ann, true));
    }
  }

  // Standalone annotations (not linked to any zone)
  const standalone = pageAnnotations.filter(a => a.linkedShapeId === null);
  for (const ann of standalone) {
    items.push(annotationRow(ann, false));
  }

  list.innerHTML = items.join('');

  // Zone row events
  list.querySelectorAll('li[data-id]').forEach(li => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn') || e.target.tagName === 'INPUT') return;
      onSelect(li.dataset.id);
    });
  });
  list.querySelectorAll('.shape-name').forEach(input => {
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

  // Annotation row events
  list.querySelectorAll('li[data-ann-id]').forEach(li => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('.ann-delete-btn')) return;
      onAnnotationSelect(li.dataset.annId);
    });
  });
  list.querySelectorAll('.ann-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onAnnotationDelete(btn.dataset.annId);
    });
  });
}

function annotationRow(ann, nested) {
  const isSelected = ann.id === state.selectedId;
  const bg = isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50';
  const indent = nested ? 'pl-6' : 'pl-2';
  const preview = escapeHtml((ann.text || '').split('\n')[0].slice(0, 28) || '(empty)');
  return `
    <li data-ann-id="${ann.id}"
        class="flex items-center gap-2 ${indent} pr-2 py-1.5 rounded-lg cursor-pointer transition-colors ${bg}">
      <svg class="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10"/>
      </svg>
      <span class="flex-1 text-xs text-slate-500 truncate">${preview}</span>
      <button data-ann-id="${ann.id}"
        class="ann-delete-btn p-1 text-slate-300 hover:text-red-500 rounded flex-shrink-0 transition-colors"
        title="Delete annotation">
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </li>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
