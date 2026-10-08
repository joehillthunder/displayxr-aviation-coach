// Calibration: place part anchors on whatever asset is loaded (your scan, a glTF, or the trainer
// engine) by clicking it. Anchors are kept per asset id in localStorage as a working draft, and
// "Export JSON" downloads them so they can be committed next to the scan (see web/assets/scans/).

const KEY = (assetId) => `coach.anchors.${assetId}`;

export function loadDraft(assetId) {
  try {
    return JSON.parse(localStorage.getItem(KEY(assetId)) || 'null');
  } catch {
    return null;
  }
}

function saveDraft(assetId, anchors) {
  try {
    localStorage.setItem(KEY(assetId), JSON.stringify(anchors));
  } catch {
    /* private window: the export button still works */
  }
}

export class Calibrator {
  constructor({ scene, knowledge, dialog, stageEl, onChange }) {
    this.scene = scene;
    this.k = knowledge;
    this.dialog = dialog;
    this.stageEl = stageEl;
    this.onChange = onChange;
    this.active = false;
    this.partSel = dialog.querySelector('#calPart');
    this.lastEl = dialog.querySelector('#calLast');
    for (const p of knowledge.parts) this.partSel.add(new Option(p.name, p.id));
    dialog.querySelector('#calExport').addEventListener('click', () => this.export());
    dialog.querySelector('#calReset').addEventListener('click', () => this.reset());
    dialog.addEventListener('close', () => this.setActive(false));
  }

  setActive(on) {
    this.active = on;
    this.stageEl.classList.toggle('calibrating', on);
    if (on) {
      this.dialog.querySelector('#calAsset').textContent = this.scene.assetId;
      if (!this.dialog.open) this.dialog.show(); // non-modal: the canvas stays clickable
    } else if (this.dialog.open) {
      this.dialog.close();
    }
  }

  /** A click on the model while calibrating: anchor the selected part there, then select the next. */
  place(pick) {
    const id = this.partSel.value;
    const p = pick.point;
    const xyz = [p.x, p.y, p.z].map((n) => Math.round(n * 1000) / 1000);
    const draft = this.current();
    draft[id] = xyz;
    saveDraft(this.scene.assetId, draft);
    this.scene.setAnchors(draft);
    this.scene.highlight([id]);
    this.lastEl.textContent = `${this.k.part(id).name} at [${xyz.join(', ')}]${pick.onSurface ? '' : ' (no surface hit: placed at the focus distance)'}`;
    this.partSel.selectedIndex = (this.partSel.selectedIndex + 1) % this.partSel.options.length;
    this.onChange?.();
  }

  current() {
    const out = {};
    for (const [id, v] of this.scene.anchors) out[id] = [v.x, v.y, v.z].map((n) => Math.round(n * 1000) / 1000);
    return out;
  }

  export() {
    const blob = new Blob([JSON.stringify({ asset: this.scene.assetId, anchors: this.current() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.scene.assetId}.anchors.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  reset() {
    try {
      localStorage.removeItem(KEY(this.scene.assetId));
    } catch {
      /* nothing stored */
    }
    this.scene.setAnchors(null);
    this.lastEl.textContent = 'Back to the default anchors.';
    this.onChange?.();
  }
}
