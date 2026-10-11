import { describe, expect, it } from 'vitest';
import { buildLineFacts } from './lineFacts';
import { parseExplanation } from './explainLine';

const cement = {
  materialId: 'cement-325', materialName: 'Cement 32.5N', quantity: 46, unit: 'per 50kg bag',
  unitPriceUsd: 11.5, stage: 'substructure', note: 'Foundation: 44.0m perimeter (550mm x 200mm)',
};

describe('the facts an explanation may use', () => {
  it('carries the line, the calculator note and the project inputs', () => {
    const facts = buildLineFacts(cement, { floorAreaM2: 120, locationType: 'peri-urban', finishLevel: 'standard' }).join('\n');
    expect(facts).toContain('46 × Cement 32.5N');
    expect(facts).toContain('Foundation: 44.0m perimeter (550mm x 200mm)');
    expect(facts).toContain('House floor area: 120 m²');
    expect(facts).toContain('Site: peri-urban');
  });

  it('includes the assumptions the calculator used for this kind of material and site', () => {
    const facts = buildLineFacts(cement, { locationType: 'rural' }).join('\n');
    expect(facts).toContain('7 bags of cement per cubic metre of concrete');
    expect(facts).toContain('500 mm wide');
    expect(facts).not.toContain('IBR');
  });

  it('uses the economy figures for an economy build', () => {
    expect(buildLineFacts(cement, { finishLevel: 'economy' }).join('\n')).toContain('6.5 bags of cement per cubic metre of concrete');
  });

  it('says when the person changed the calculated quantity', () => {
    const facts = buildLineFacts({ ...cement, calculatedQuantity: 40 }, {}).join('\n');
    expect(facts).toContain('worked out 40; the person changed it to 46');
  });

  it('does not treat brickforce as bricks', () => {
    const facts = buildLineFacts({ ...cement, materialId: 'brickforce', materialName: 'Brickforce', unit: 'per roll', stage: 'superstructure' }, {}).join('\n');
    expect(facts).not.toContain('bricks or');
  });

  it('describes price sources without naming suppliers', () => {
    const facts = buildLineFacts({ ...cement, materialId: 'rebar-12', unitPriceUsd: 4.95 }, {}).join('\n');
    expect(facts).not.toMatch(/ZBMS|Union Hardware|Halsteds/);
  });
});

describe('reading the explanation back', () => {
  it('strips markdown and limits the list', () => {
    expect(parseExplanation({ why: '**Because** of the slab.', onSite: 'Mixed', changesIt: ['a', 'b', 'c', 'd'] }))
      .toEqual({ why: 'Because of the slab.', onSite: 'Mixed', changesIt: ['a', 'b', 'c'] });
  });
  it('rejects an empty answer', () => {
    expect(parseExplanation({ why: '' })).toBeNull();
  });
});
