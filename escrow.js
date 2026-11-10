/*
 * EscrowSnap – kernlogica voor de escrow-levenscyclus.
 *
 * Deze module bevat alleen pure functies (geen DOM, geen opslag), zodat
 * de regels los van de interface getest kunnen worden.
 *
 * Levenscyclus:
 *   concept -> gefinancierd -> opgeleverd -> vrijgegeven
 *
 * Bedragen worden altijd in centen (gehele getallen) bewaard om
 * afrondingsfouten met floats te voorkomen.
 */
(function (root) {
  'use strict';

  const STATUS = Object.freeze({
    CONCEPT: 'concept',
    GEFINANCIERD: 'gefinancierd',
    OPGELEVERD: 'opgeleverd',
    VRIJGEGEVEN: 'vrijgegeven',
  });

  const STATUS_LABEL = Object.freeze({
    concept: 'Concept',
    gefinancierd: 'Geld in escrow',
    opgeleverd: 'Werk opgeleverd',
    vrijgegeven: 'Vrijgegeven',
  });

  class EscrowError extends Error {
    constructor(message) {
      super(message);
      this.name = 'EscrowError';
    }
  }

  function requireText(value, field) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) throw new EscrowError(`${field} is verplicht.`);
    return text;
  }

  /**
   * Maakt een nieuwe klus in status "concept".
   * @param {{id:string, title:string, clientName:string, freelancerName:string, amountCents:number, now:string}} input
   */
  function createJob(input) {
    const title = requireText(input.title, 'Omschrijving');
    const clientName = requireText(input.clientName, 'Naam opdrachtgever');
    const freelancerName = requireText(input.freelancerName, 'Naam zzp\'er');
    const amountCents = input.amountCents;
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new EscrowError('Bedrag moet een positief geheel aantal centen zijn.');
    }
    return {
      id: requireText(input.id, 'Id'),
      title,
      clientName,
      freelancerName,
      amountCents,
      status: STATUS.CONCEPT,
      createdAt: input.now,
      updatedAt: input.now,
      fundedAt: null,
      proof: null,
      releasedAt: null,
    };
  }

  /** Opdrachtgever zet het bedrag over naar de escrow-rekening. */
  function fundEscrow(job, now) {
    assertStatus(job, STATUS.CONCEPT, 'Je kunt alleen geld in escrow zetten voor een concept-klus.');
    return { ...job, status: STATUS.GEFINANCIERD, fundedAt: now, updatedAt: now };
  }

  /**
   * Zzp'er levert werk op met een bewijsstuk (foto of document).
   * @param {{name:string, type:string, size:number, dataUrl?:string|null}} proof
   */
  function submitWork(job, proof, now) {
    assertStatus(job, STATUS.GEFINANCIERD, 'Werk kan pas worden opgeleverd als het geld in escrow staat.');
    if (!proof || typeof proof !== 'object') {
      throw new EscrowError('Voeg een bewijsstuk toe (foto of document).');
    }
    const name = requireText(proof.name, 'Bestandsnaam');
    return {
      ...job,
      status: STATUS.OPGELEVERD,
      proof: {
        name,
        type: typeof proof.type === 'string' ? proof.type : '',
        size: Number.isFinite(proof.size) ? proof.size : 0,
        dataUrl: typeof proof.dataUrl === 'string' ? proof.dataUrl : null,
        submittedAt: now,
      },
      updatedAt: now,
    };
  }

  /** Opdrachtgever keurt het werk goed; het geld wordt vrijgegeven aan de zzp'er. */
  function approveWork(job, now) {
    assertStatus(job, STATUS.OPGELEVERD, 'Je kunt pas akkoord geven nadat het werk is opgeleverd.');
    return { ...job, status: STATUS.VRIJGEGEVEN, releasedAt: now, updatedAt: now };
  }

  /** Welke acties zijn op dit moment toegestaan? Handig voor de UI. */
  function availableActions(job) {
    switch (job.status) {
      case STATUS.CONCEPT: return ['fund'];
      case STATUS.GEFINANCIERD: return ['submit'];
      case STATUS.OPGELEVERD: return ['approve'];
      default: return [];
    }
  }

  function assertStatus(job, expected, message) {
    if (!job || job.status !== expected) throw new EscrowError(message);
  }

  const api = {
    STATUS,
    STATUS_LABEL,
    EscrowError,
    createJob,
    fundEscrow,
    submitWork,
    approveWork,
    availableActions,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.EscrowSnap = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
