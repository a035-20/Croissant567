/* EscrowSnap – interface. Gebruikt de logica uit escrow.js (window.EscrowSnap). */
(function () {
  'use strict';

  const E = window.EscrowSnap;
  const STORAGE_KEY = 'escrowsnap.jobs.v1';
  const MAX_PROOF_BYTES = 2 * 1024 * 1024; // 2 MB, zodat localStorage niet vol loopt

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const c of children) node.append(c);
    return node;
  };

  let jobs = loadJobs();
  let selectedId = null;

  // ---------- opslag (per browser; fouten worden opgevangen) ----------
  function loadJobs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      // Beschadigde of gemanipuleerde items overslaan i.p.v. de hele pagina te breken.
      return parsed.map(E.sanitizeJob).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function saveJobs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
      return true;
    } catch (_) {
      toast('Opslaan lukt niet in deze browser. Het bewijsstuk is mogelijk te groot.');
      return false;
    }
  }

  function replaceJob(updated) {
    jobs = jobs.map((j) => (j.id === updated.id ? updated : j));
    saveJobs();
  }

  // ---------- hulpfuncties ----------
  const eur = (cents) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  const dateNl = (iso) =>
    iso ? new Date(iso).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  function toast(message) {
    const t = $('#toast');
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => (t.hidden = true), 3500);
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // ---------- lijst ----------
  function renderList() {
    const list = $('#job-list');
    list.replaceChildren();
    $('#empty').hidden = jobs.length > 0;

    for (const job of [...jobs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
      const btn = el('button', { type: 'button', className: 'link' }, [
        el('span', {}, [
          el('span', { className: 'title', textContent: job.title }),
          el('br'),
          el('span', { className: 'sub', textContent: `${job.clientName} → ${job.freelancerName}` }),
        ]),
        el('span', { className: 'sub', textContent: `${eur(job.amountCents)} · ${E.STATUS_LABEL[job.status]}` }),
      ]);
      btn.addEventListener('click', () => {
        selectedId = job.id;
        renderDetail();
        $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      list.append(el('li', {}, [btn]));
    }
  }

  // ---------- detail ----------
  const STEPS = [
    { key: E.STATUS.CONCEPT, label: '1. Klus aangemaakt' },
    { key: E.STATUS.GEFINANCIERD, label: '2. Geld in escrow' },
    { key: E.STATUS.OPGELEVERD, label: '3. Werk opgeleverd' },
    { key: E.STATUS.VRIJGEGEVEN, label: '4. Vrijgegeven' },
  ];

  function renderDetail() {
    const job = jobs.find((j) => j.id === selectedId);
    const detail = $('#detail');
    if (!job) {
      detail.hidden = true;
      return;
    }
    detail.hidden = false;

    $('#detail-title').textContent = job.title;
    const status = $('#detail-status');
    status.textContent = E.STATUS_LABEL[job.status];
    status.className = 'badge ' + job.status;

    $('#detail-meta').replaceChildren(
      ...[
        ['Opdrachtgever', job.clientName],
        ['Zzp\'er', job.freelancerName],
        ['Bedrag', eur(job.amountCents)],
        ['Aangemaakt', dateNl(job.createdAt)],
        job.fundedAt && ['In escrow', dateNl(job.fundedAt)],
        job.releasedAt && ['Vrijgegeven', dateNl(job.releasedAt)],
      ]
        .filter(Boolean)
        .flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })])
    );

    renderSteps(job);
    renderActions(job);
    renderProof(job);
  }

  function renderSteps(job) {
    const order = STEPS.map((s) => s.key);
    const currentIndex = order.indexOf(job.status);
    $('#steps').replaceChildren(
      ...STEPS.map((s, i) => {
        const cls = i < currentIndex ? 'done' : i === currentIndex ? 'current' : '';
        return el('div', { className: cls, textContent: s.label });
      })
    );
  }

  function renderActions(job) {
    const box = $('#actions');
    box.replaceChildren();
    const actions = E.availableActions(job);

    if (actions.includes('fund')) {
      box.append(
        el('p', { className: 'hint', textContent: 'Opdrachtgever: zet het bedrag over naar de veilige tussenrekening.' }),
        actionButton(`Betaal ${eur(job.amountCents)} in escrow`, () => {
          const updated = E.fundEscrow(job, new Date().toISOString());
          replaceJob(updated);
          toast('Geld staat in escrow. De zzp\'er kan nu beginnen.');
          refresh();
        })
      );
    }

    if (actions.includes('submit')) {
      const fileInput = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,application/pdf' });
      fileInput.id = 'proof-input';
      box.append(
        el('p', { className: 'hint', textContent: 'Zzp\'er: upload een foto of document als bewijs dat het werk af is.' }),
        el('label', {}, [el('span', { textContent: 'Bewijsstuk (max. 2 MB)' }), fileInput]),
        actionButton('Lever werk op', async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return toast('Kies eerst een bewijsstuk.');
          if (file.size > MAX_PROOF_BYTES) return toast('Bestand is groter dan 2 MB.');
          if (!E.isAllowedProofType(file.type)) {
            return toast('Alleen PNG, JPG, WebP, GIF of PDF zijn toegestaan.');
          }
          const dataUrl = await readAsDataUrl(file);
          try {
            const updated = E.submitWork(
              job,
              { name: file.name, type: file.type, size: file.size, dataUrl },
              new Date().toISOString()
            );
            replaceJob(updated);
            toast('Werk opgeleverd. De opdrachtgever kan nu akkoord geven.');
            refresh();
          } catch (err) {
            toast(err.message);
          }
        })
      );
    }

    if (actions.includes('approve')) {
      box.append(
        el('p', { className: 'hint', textContent: 'Opdrachtgever: bekijk het bewijs hieronder en geef akkoord om het geld vrij te geven.' }),
        actionButton(`Akkoord, geef ${eur(job.amountCents)} vrij`, () => {
          const updated = E.approveWork(job, new Date().toISOString());
          replaceJob(updated);
          toast('Geld is vrijgegeven aan de zzp\'er.');
          refresh();
        })
      );
    }

    if (actions.length === 0) {
      box.append(el('p', { className: 'hint', textContent: 'Deze klus is afgerond. Het geld is vrijgegeven.' }));
    }
  }

  function renderProof(job) {
    const block = $('#proof-block');
    const view = $('#proof-view');
    if (!job.proof) {
      block.hidden = true;
      return;
    }
    block.hidden = false;
    const children = [
      el('div', { className: 'proof-file' }, [
        el('span', { textContent: `${job.proof.name} · ${dateNl(job.proof.submittedAt)}` }),
      ]),
    ];
    const { dataUrl, type, name } = job.proof;
    if (E.isSafeProofDataUrl(dataUrl, type)) {
      if (type.startsWith('image/')) {
        children.push(el('img', { src: dataUrl, alt: `Bewijsstuk: ${name}` }));
      } else {
        children.push(el('a', { href: dataUrl, download: name, textContent: 'Document downloaden' }));
      }
    }
    view.replaceChildren(...children);
  }

  function actionButton(label, onClick) {
    const btn = el('button', { type: 'button', className: 'primary', textContent: label });
    btn.addEventListener('click', () => {
      btn.disabled = true;
      Promise.resolve()
        .then(onClick)
        .finally(() => {
          btn.disabled = false;
        });
    });
    return btn;
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function refresh() {
    renderList();
    renderDetail();
  }

  // ---------- nieuwe klus ----------
  $('#job-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const errorEl = $('#form-error');
    errorEl.hidden = true;

    const amountCents = E.parseAmountToCents(data.amount);
    try {
      const job = E.createJob({
        id: newId(),
        title: data.title,
        clientName: data.clientName,
        freelancerName: data.freelancerName,
        amountCents,
        now: new Date().toISOString(),
      });
      jobs = [...jobs, job];
      saveJobs();
      selectedId = job.id;
      form.reset();
      refresh();
      toast('Klus aangemaakt. Volgende stap: betalen in escrow.');
    } catch (err) {
      errorEl.textContent = Number.isNaN(amountCents) && err.message.startsWith('Bedrag')
        ? 'Vul een geldig bedrag in, bijv. 250 of 250,50.'
        : err.message;
      errorEl.hidden = false;
    }
  });

  refresh();
})();
