import { describe, expect, it } from 'vitest';
import { parseArenaLogLine } from '../src/main/arena-log-parser';

describe('parseArenaLogLine', () => {
  it.each(['BotDraftDraftStatus', 'BotDraft_DraftStatus'])(
    'parses a draft start using the %s marker',
    (marker) => {
      const line =
        `[UnityCrossThreadLogger] ${marker} ` +
        '{"request":{"EventName":"QuickDraft_fra_2026"}} trailing text';

      expect(parseArenaLogLine(line)).toEqual({
        type: 'draft-started',
        setCode: 'FRA',
      });
    },
  );

  it('parses a received pack and converts Arena indexes to display numbers', () => {
    const payload = JSON.stringify({
      DraftStatus: 'PickNext',
      EventName: 'QuickDraft_FRA_2026',
      PackNumber: 0,
      PickNumber: '1',
      DraftPack: [106255, '106327', 106240],
    });
    const line = JSON.stringify({
      CurrentModule: 'BotDraft',
      Payload: payload,
    });

    expect(parseArenaLogLine(`[UnityCrossThreadLogger] ${line}`)).toEqual({
      type: 'pack-received',
      setCode: 'FRA',
      packNumber: 1,
      pickNumber: 2,
      cardIds: [106255, 106327, 106240],
    });
  });

  it.each([
    'unrelated Arena output',
    'BotDraftDraftStatus {"EventName":"PremierDraft_FRA_2026"}',
    '{"CurrentModule":"Draft","Payload":{"DraftStatus":"PickNext"}}',
    '{"CurrentModule":"BotDraft","Payload":{"DraftStatus":"PickNext","EventName":"QuickDraft_FRA_2026","PackNumber":0,"PickNumber":0}}',
    '{"CurrentModule":"BotDraft","Payload":"not json"}',
  ])('ignores a line that is not a complete Quick Draft event', (line) => {
    expect(parseArenaLogLine(line)).toBeNull();
  });
});
