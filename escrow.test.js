'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./escrow.js');

const NOW = '2026-11-10T10:00:00.000Z';
const LATER = '2026-11-10T10:05:00.000Z';

function newJob(overrides = {}) {
  return E.createJob({
    id: 'job-1',
    title: 'Logo ontwerpen',
    clientName: 'Acme BV',
    freelancerName: 'Sam Zzp',
    amountCents: 25000,
    now: NOW,
    ...overrides,
  });
}

const PROOF = { name: 'logo-final.png', type: 'image/png', size: 1234, dataUrl: 'data:image/png;base64,AAAA' };

test('createJob maakt een concept-klus met integer-bedrag', () => {
  const job = newJob();
  assert.equal(job.status, E.STATUS.CONCEPT);
  assert.equal(job.amountCents, 25000);
  assert.equal(job.proof, null);
});

test('createJob weigert ongeldige bedragen', () => {
  for (const amountCents of [0, -100, 12.5, NaN, '100', undefined]) {
    assert.throws(() => newJob({ amountCents }), E.EscrowError, `bedrag ${amountCents}`);
  }
});

test('createJob weigert lege verplichte velden', () => {
  assert.throws(() => newJob({ title: '   ' }), E.EscrowError);
  assert.throws(() => newJob({ clientName: '' }), E.EscrowError);
  assert.throws(() => newJob({ freelancerName: undefined }), E.EscrowError);
});

test('volledige happy path: concept -> gefinancierd -> opgeleverd -> vrijgegeven', () => {
  let job = newJob();
  job = E.fundEscrow(job, LATER);
  assert.equal(job.status, E.STATUS.GEFINANCIERD);
  assert.equal(job.fundedAt, LATER);

  job = E.submitWork(job, PROOF, '2026-11-10T11:00:00.000Z');
  assert.equal(job.status, E.STATUS.OPGELEVERD);
  assert.equal(job.proof.name, 'logo-final.png');

  job = E.approveWork(job, '2026-11-10T12:00:00.000Z');
  assert.equal(job.status, E.STATUS.VRIJGEGEVEN);
  assert.equal(job.releasedAt, '2026-11-10T12:00:00.000Z');
});

test('acties buiten de volgorde worden geweigerd', () => {
  const concept = newJob();
  assert.throws(() => E.submitWork(concept, PROOF, LATER), E.EscrowError);
  assert.throws(() => E.approveWork(concept, LATER), E.EscrowError);

  const funded = E.fundEscrow(concept, LATER);
  assert.throws(() => E.fundEscrow(funded, LATER), E.EscrowError, 'dubbel financieren');
  assert.throws(() => E.approveWork(funded, LATER), E.EscrowError, 'goedkeuren zonder oplevering');
});

test('geld wordt niet vrijgegeven zonder oplevering', () => {
  const funded = E.fundEscrow(newJob(), LATER);
  assert.equal(funded.releasedAt, null);
  assert.throws(() => E.approveWork(funded, LATER), E.EscrowError);
});

test('opleveren vereist een bewijsstuk met bestandsnaam', () => {
  const funded = E.fundEscrow(newJob(), LATER);
  assert.throws(() => E.submitWork(funded, null, LATER), E.EscrowError);
  assert.throws(() => E.submitWork(funded, { name: '  ' }, LATER), E.EscrowError);
});

test('vrijgegeven klus kan niet opnieuw worden gewijzigd', () => {
  let job = E.fundEscrow(newJob(), LATER);
  job = E.submitWork(job, PROOF, LATER);
  job = E.approveWork(job, LATER);
  assert.throws(() => E.approveWork(job, LATER), E.EscrowError);
  assert.throws(() => E.submitWork(job, PROOF, LATER), E.EscrowError);
});

test('state-functies muteren het oorspronkelijke object niet', () => {
  const concept = newJob();
  const snapshot = JSON.stringify(concept);
  E.fundEscrow(concept, LATER);
  assert.equal(JSON.stringify(concept), snapshot);
});

test('parseAmountToCents accepteert nl- en en-notatie', () => {
  assert.equal(E.parseAmountToCents('250'), 25000);
  assert.equal(E.parseAmountToCents('250,5'), 25050);
  assert.equal(E.parseAmountToCents('250.50'), 25050);
  assert.equal(E.parseAmountToCents('  0,01 '), 1);
});

test('parseAmountToCents weigert ongeldige invoer', () => {
  for (const raw of ['', 'abc', '-5', '1,234', '1e3', '0x10', '1.2.3', null, undefined]) {
    assert.ok(Number.isNaN(E.parseAmountToCents(raw)), `zou NaN moeten zijn voor ${raw}`);
  }
});

test('isSafeProofDataUrl laat alleen bekende types toe', () => {
  assert.equal(E.isSafeProofDataUrl('data:image/png;base64,AAAA', 'image/png'), true);
  assert.equal(E.isSafeProofDataUrl('data:application/pdf;base64,AAAA', 'application/pdf'), true);
  // Type klopt niet met de inhoud van de data-URL
  assert.equal(E.isSafeProofDataUrl('data:text/html;base64,AAAA', 'image/png'), false);
  // Onbekend of gevaarlijk type
  assert.equal(E.isSafeProofDataUrl('data:image/svg+xml;base64,AAAA', 'image/svg+xml'), false);
  assert.equal(E.isSafeProofDataUrl('javascript:alert(1)', 'image/png'), false);
  assert.equal(E.isSafeProofDataUrl(null, 'image/png'), false);
});

test('sanitizeJob keurt beschadigde opslagobjecten af', () => {
  const good = newJob();
  assert.deepEqual(E.sanitizeJob(good), good);
  assert.equal(E.sanitizeJob(null), null);
  assert.equal(E.sanitizeJob({ ...good, status: 'hacked' }), null);
  assert.equal(E.sanitizeJob({ ...good, amountCents: '250' }), null);
  assert.equal(E.sanitizeJob({ ...good, title: '' }), null);
});

test('availableActions geeft per status de juiste acties', () => {
  let job = newJob();
  assert.deepEqual(E.availableActions(job), ['fund']);
  job = E.fundEscrow(job, LATER);
  assert.deepEqual(E.availableActions(job), ['submit']);
  job = E.submitWork(job, PROOF, LATER);
  assert.deepEqual(E.availableActions(job), ['approve']);
  job = E.approveWork(job, LATER);
  assert.deepEqual(E.availableActions(job), []);
});
