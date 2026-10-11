import { describe, expect, it } from 'vitest';
import {
  decodeBoreholeExplorerState,
  encodeBoreholeExplorerState,
  type BoreholeExplorerState,
} from './explorerUrl';

const STATE: BoreholeExplorerState = {
  budget: 6500,
  depth: 65,
  purpose: 'domestic',
  location: 'bulawayo',
  enabledCards: {
    drilling: true,
    casing: true,
    pump: true,
    tank: false,
    services: true,
    permits: true,
    transport: false,
  },
  pumpType: 'hybrid',
  casingGrade: 'class_9',
  tankSize: 'none',
  useCombo: false,
  userPickedComponents: true,
};

const decode = (query: string) => decodeBoreholeExplorerState(new URLSearchParams(query));

describe('borehole explorer links', () => {
  it('rebuilds exactly the borehole that was shared', () => {
    expect(decodeBoreholeExplorerState(encodeBoreholeExplorerState(STATE))).toEqual(STATE);
  });

  it('opens on the borehole tab', () => {
    expect(encodeBoreholeExplorerState(STATE).get('mode')).toBe('borehole');
  });

  it('leaves components out when the budget chose them, so the recipient re-fits them too', () => {
    const link = encodeBoreholeExplorerState({ ...STATE, userPickedComponents: false });
    const decoded = decodeBoreholeExplorerState(link);
    expect(decoded.pumpType).toBeUndefined();
    expect(decoded.userPickedComponents).toBeUndefined();
  });

  it('carries hand-picked components only as a complete set', () => {
    // Half a set would leave the explorer re-fitting the rest around it.
    expect(decode('pump=solar&casing=class_6').pumpType).toBeUndefined();
    expect(decode('pump=solar&casing=class_6&tank=5000&combo=1').userPickedComponents).toBe(true);
  });

  it('snaps depth to the slider and keeps it in range', () => {
    expect(decode('depth=67').depth).toBe(65);
    expect(decode('depth=5').depth).toBe(20);
    expect(decode('depth=999').depth).toBe(160);
  });

  it('ignores values the explorer does not offer', () => {
    expect(decode('purpose=industrial&location=atlantis&pump=diesel&budget=-1')).toEqual({});
    // An inherited object key is not a location.
    expect(decode('location=toString').location).toBeUndefined();
  });
});
