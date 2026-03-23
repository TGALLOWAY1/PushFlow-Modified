import { type FingerType } from '../types/fingerModel';

const FINGER_NUM_TO_TYPE: Record<string, FingerType> = {
  '1': 'thumb',
  '2': 'index',
  '3': 'middle',
  '4': 'ring',
  '5': 'pinky',
};

const FINGER_TYPE_TO_NUM: Record<FingerType, string> = {
  thumb: '1',
  index: '2',
  middle: '3',
  ring: '4',
  pinky: '5',
};

const LEGACY_FINGER_MAP: Record<string, FingerType> = {
  Th: 'thumb',
  Ix: 'index',
  Md: 'middle',
  Rg: 'ring',
  Pk: 'pinky',
};

export interface ParsedFingerConstraint {
  hand: 'left' | 'right';
  finger: FingerType;
}

export function formatFingerConstraint(
  hand: 'left' | 'right',
  finger: FingerType,
): string {
  return `${hand === 'left' ? 'L' : 'R'}${FINGER_TYPE_TO_NUM[finger]}`;
}

export function parseFingerConstraint(
  constraint: string,
): ParsedFingerConstraint | null {
  const compact = constraint.match(/^([LlRr])([1-5])$/);
  if (compact) {
    return {
      hand: compact[1].toUpperCase() === 'L' ? 'left' : 'right',
      finger: FINGER_NUM_TO_TYPE[compact[2]],
    };
  }

  const legacy = constraint.match(/^([LR])-(\w+)$/);
  if (legacy) {
    const finger = LEGACY_FINGER_MAP[legacy[2]];
    if (finger) {
      return {
        hand: legacy[1] === 'L' ? 'left' : 'right',
        finger,
      };
    }
  }

  return null;
}
