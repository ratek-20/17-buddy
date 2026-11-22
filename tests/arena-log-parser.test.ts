import { describe, expect, it } from 'vitest';
import {
  ArenaLogParser,
  parseArenaLogLine,
} from '../src/main/arena-log-parser';

describe('parseArenaLogLine', () => {
  it.each(['Draft', 'DeckBuilder', 'DeckDetails', 'Home', 'EventLanding'])(
    'parses navigation to the %s scene',
    (sceneName) => {
      const line =
        '[UnityCrossThreadLogger] SceneChange ' +
        JSON.stringify({
          fromSceneName: 'Draft',
          toSceneName: sceneName,
          initiator: 'User',
          context: 'navigation',
        }) +
        ' trailing text';

      expect(parseArenaLogLine(line)).toEqual({
        type: 'scene-changed',
        sceneName,
      });
    },
  );

  it.each([
    'SceneChange {"fromSceneName":"Draft"}',
    'SceneChange {"toSceneName":null}',
    'SceneChange {"toSceneName":5}',
    'SceneChange {"toSceneName":""}',
    'SceneChange {"toSceneName":"DeckBuilder"',
    'SceneLoader:LoadContentInternal(NavContentType, SceneChangeInitiator)',
  ])('ignores an incomplete scene change: %s', (line) => {
    expect(parseArenaLogLine(line)).toBeNull();
  });

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
      PickedCards: [106325, '106371'],
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
      pickedCardIds: [106325, 106371],
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

describe('ArenaLogParser Premier Draft support', () => {
  const join = (eventName = 'PremierDraft_TDM_2026'): string =>
    'EventJoin ' +
    JSON.stringify({ request: JSON.stringify({ EventName: eventName }) });

  const notify = (overrides: Record<string, unknown> = {}): string =>
    '[UnityCrossThreadLogger]Draft.Notify ' +
    JSON.stringify({
      draftId: 'test-draft',
      SelfPack: 1,
      SelfPick: 2,
      PackCards: '95516,95712,95712',
      ...overrides,
    });

  const makePick = (overrides: Record<string, unknown> = {}): string =>
    'EventPlayerDraftMakePick ' +
    JSON.stringify({
      request: JSON.stringify({
        DraftId: 'test-draft',
        Pack: 1,
        Pick: 1,
        GrpIds: [95843],
        ...overrides,
      }),
    });

  const businessPick = (overrides: Record<string, unknown> = {}): string =>
    'LogBusinessEvents ' +
    JSON.stringify({
      DraftId: 'test-draft',
      EventId: 'PremierDraft_TDM_2026',
      PackNumber: 1,
      PickNumber: 1,
      PickGrpId: 95843,
      CardsInPack: [95843, 95800],
      ...overrides,
    });

  it.each(['EventJoin', 'Event_Join'])(
    'recognizes a Premier Draft joined through %s',
    (marker) => {
      const parser = new ArenaLogParser();
      expect(parser.parseLine(join().replace('EventJoin', marker))).toEqual({
        type: 'draft-started',
        setCode: 'TDM',
      });
    },
  );

  it('uses one-based Premier positions and preserves pack order and duplicate cards', () => {
    const parser = new ArenaLogParser();
    parser.parseLine(join());
    parser.parseLine(makePick());

    expect(parser.parseLine(notify())).toEqual({
      type: 'pack-received',
      setCode: 'TDM',
      packNumber: 1,
      pickNumber: 2,
      cardIds: [95516, 95712, 95712],
      pickedCardIds: [95843],
    });
    expect(
      parser.parseLine(notify({ SelfPack: '2', SelfPick: '1' })),
    ).toMatchObject({
      packNumber: 2,
      pickNumber: 1,
      pickedCardIds: [95843],
    });
  });

  it.each(['EventPlayerDraftMakePick', 'Event_PlayerDraftMakePick'])(
    'tracks %s picks immediately and clears the picked pack until the next notification',
    (marker) => {
      const parser = new ArenaLogParser();
      parser.parseLine(join());
      parser.parseLine(notify({ SelfPick: 1 }));

      expect(
        parser.parseLine(
          makePick().replace('EventPlayerDraftMakePick', marker),
        ),
      ).toMatchObject({
        cardIds: [],
        pickedCardIds: [95843],
      });
      expect(parser.parseLine(notify())).toMatchObject({
        cardIds: [95516, 95712, 95712],
        pickedCardIds: [95843],
      });
    },
  );

  it('counts duplicate pick records once while preserving copies taken on different picks', () => {
    const parser = new ArenaLogParser();
    parser.parseLine(join());
    parser.parseLine(makePick());
    parser.parseLine(makePick());
    parser.parseLine(businessPick());
    parser.parseLine(makePick({ Pick: 2, GrpIds: [95843, 95712] }));

    expect(parser.parseLine(notify({ SelfPick: 3 }))).toMatchObject({
      pickedCardIds: [95843, 95843, 95712],
    });
  });

  it('accepts the older singular pick field inside nested payloads', () => {
    const parser = new ArenaLogParser();
    parser.parseLine(
      'Event_Join ' +
        JSON.stringify({ payload: { EventName: 'PremierDraft_tdm_2026' } }),
    );
    parser.parseLine(makePick({ GrpIds: undefined, GrpId: '95516' }));

    expect(parser.parseLine(notify())).toMatchObject({
      setCode: 'TDM',
      pickedCardIds: [95516],
    });
  });

  it('uses business records for auto-picks without replacing a live pack with historical cards', () => {
    const parser = new ArenaLogParser();
    parser.parseLine(join());
    parser.parseLine(notify());

    expect(parser.parseLine(businessPick())).toMatchObject({
      packNumber: 1,
      pickNumber: 2,
      cardIds: [95516, 95712, 95712],
      pickedCardIds: [95843],
    });
    expect(parser.parseLine(notify({ SelfPick: 1 }))).toBeNull();
  });

  it('recovers the set from a business event if started after joining a draft', () => {
    const parser = new ArenaLogParser();
    expect(parser.parseLine(notify())).toBeNull();
    expect(parser.parseLine(businessPick())).toMatchObject({
      setCode: 'TDM',
      pickNumber: 2,
      cardIds: [95516, 95712, 95712],
      pickedCardIds: [95843],
    });
  });

  it('recognizes a reopened PlayerDraft course without losing picks on repeated course responses', () => {
    const parser = new ArenaLogParser();
    const course =
      'EventGetCoursesV2 ' +
      JSON.stringify({
        Courses: [
          {
            CurrentModule: 'Match',
            InternalEventName: 'PremierDraft_BLB_2026',
          },
          {
            CurrentModule: 'PlayerDraft',
            InternalEventName: 'PremierDraft_TDM_2026',
            DraftId: 'test-draft',
          },
        ],
      });
    expect(parser.parseLine(course)).toEqual({
      type: 'draft-started',
      setCode: 'TDM',
    });
    parser.parseLine(makePick());
    expect(parser.parseLine(course)).toBeNull();
    expect(parser.parseLine(notify())).toMatchObject({
      setCode: 'TDM',
      pickedCardIds: [95843],
    });
  });

  it('can reset context when the watched log is replaced or truncated', () => {
    const parser = new ArenaLogParser();
    parser.parseLine(join());
    parser.parseLine(makePick());
    parser.parseLine(notify());
    parser.reset();

    expect(parser.parseLine(notify({ draftId: 'new-draft' }))).toBeNull();
    expect(
      parser.parseLine(businessPick({ DraftId: 'new-draft' })),
    ).toMatchObject({ pickedCardIds: [95843] });
  });

  it('resets picks for a new draft of the same set and rejects messages from another draft', () => {
    const parser = new ArenaLogParser();
    parser.parseLine(join());
    parser.parseLine(makePick());
    parser.parseLine(notify());
    parser.parseLine(join());
    expect(
      parser.parseLine(notify({ draftId: 'new-draft', SelfPick: 1 })),
    ).toMatchObject({
      pickedCardIds: [],
    });

    expect(parser.parseLine(notify())).toBeNull();
    expect(parser.parseLine(businessPick())).toBeNull();
    expect(parser.parseLine(makePick())).toBeNull();
    expect(parser.parseLine(businessPick())).toBeNull();
    expect(parser.parseLine(notify({ draftId: 'new-draft' }))).toMatchObject({
      pickedCardIds: [],
    });
  });

  it.each([
    'TraditionalDraft_TDM_2026',
    'Sealed_TDM_2026',
    'QuickDraft_TDM_2026',
  ])('does not reuse Premier context after joining %s', (eventName) => {
    const parser = new ArenaLogParser();
    parser.parseLine(join());
    parser.parseLine(makePick());
    parser.parseLine(join(eventName));

    expect(parser.parseLine(notify())).toBeNull();
  });

  it.each([
    { SelfPack: 0 },
    { SelfPick: null },
    { SelfPick: '' },
    { SelfPick: -1 },
    { draftId: '' },
    { PackCards: '' },
    { PackCards: '95516,,95712' },
    { PackCards: '95516,invalid' },
    { PackCards: [95516, null] },
  ])(
    'ignores malformed notifications without damaging the current draft: %j',
    (overrides) => {
      const parser = new ArenaLogParser();
      parser.parseLine(join());
      parser.parseLine(makePick());

      expect(parser.parseLine(notify(overrides))).toBeNull();
      expect(parser.parseLine(notify())).toMatchObject({
        pickedCardIds: [95843],
      });
    },
  );

  it('ignores invalid picks and incomplete request envelopes', () => {
    const parser = new ArenaLogParser();
    parser.parseLine(join());
    expect(parser.parseLine(makePick({ GrpIds: [''] }))).toBeNull();
    expect(parser.parseLine(businessPick({ PickGrpId: null }))).toBeNull();
    expect(
      parser.parseLine('EventPlayerDraftMakePick {"request":"invalid"}'),
    ).toBeNull();
    expect(parser.parseLine(notify())).toMatchObject({ pickedCardIds: [] });
  });

  it('keeps parser instances independent and preserves Quick Draft and scene events', () => {
    const parser = new ArenaLogParser();
    const otherParser = new ArenaLogParser();
    parser.parseLine(join());
    expect(otherParser.parseLine(notify())).toBeNull();

    const quickPack = JSON.stringify({
      CurrentModule: 'BotDraft',
      Payload: {
        DraftStatus: 'PickNext',
        EventName: 'QuickDraft_BLB_2026',
        PackNumber: 0,
        PickNumber: 0,
        DraftPack: [91648],
        PickedCards: [],
      },
    });
    expect(parser.parseLine(quickPack)).toEqual(parseArenaLogLine(quickPack));
    expect(parser.parseLine(notify())).toBeNull();
    expect(parser.parseLine('SceneChange {"toSceneName":"Draft"}')).toEqual({
      type: 'scene-changed',
      sceneName: 'Draft',
    });
  });
});
