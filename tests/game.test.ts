import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  crossRiver,
  heal,
  hunt,
  LANDMARKS,
  repair,
  rest,
  setPace,
  setRations,
  SHOP,
  TOTAL_MILES,
  trade,
  travel,
  validateSave,
  type GameState,
} from "../src/game.ts";

function atRiver(): GameState {
  let state = createGame({ seed: 42 });
  while (state.status === "traveling") state = travel(state);
  assert.equal(state.status, "river");
  return state;
}

function freeze(state: GameState): GameState {
  Object.freeze(state.members);
  state.members.forEach(Object.freeze);
  Object.freeze(state.log);
  state.log.forEach(Object.freeze);
  Object.freeze(state.crossedRivers);
  if (state.river) Object.freeze(state.river);
  return Object.freeze(state);
}

test("a new journey has a complete, independent party and profession benefits", () => {
  const farmer = createGame({
    seed: 9,
    partyName: "  The Owls  ",
    names: ["Avery"],
  });
  const banker = createGame({ profession: "banker", seed: 9 });
  assert.equal(farmer.partyName, "The Owls");
  assert.equal(farmer.members.length, 5);
  assert.equal(farmer.members[0]!.name, "Avery");
  assert.equal(
    farmer.members.every((member) => member.alive && member.health === 100),
    true,
  );
  assert.ok(banker.money > farmer.money);
  assert.equal(farmer.location, "Independence");
  assert.deepEqual(validateSave(farmer), farmer);
});

test("travel is deterministic, advances time, consumes resources, and leaves input untouched", () => {
  const initial = freeze(createGame({ seed: 321 }));
  const first = travel(initial);
  const second = travel(initial);
  assert.deepEqual(first, second);
  assert.equal(initial.day, 1);
  assert.equal(initial.miles, 0);
  assert.equal(initial.food, 500);
  assert.equal(first.day, 4);
  assert.ok(first.miles > 0);
  assert.ok(first.food < initial.food);
  assert.ok(first.wagon < initial.wagon);
  assert.notEqual(first.members, initial.members);
});

test("travel stops exactly at rivers and cannot continue before crossing", () => {
  const state = freeze(atRiver());
  assert.equal(
    state.miles,
    LANDMARKS.find((landmark) => landmark.type === "river")!.miles,
  );
  const blocked = travel(state);
  assert.equal(blocked.day, state.day);
  assert.equal(blocked.miles, state.miles);
  assert.equal(blocked.food, state.food);
  assert.equal(blocked.status, "river");
  const crossed = crossRiver(state, "ferry");
  assert.equal(crossed.money, state.money - state.river!.ferryCost);
  assert.equal(crossed.day, state.day + 1);
  assert.equal(crossed.status, "traveling");
  assert.equal(crossed.river, null);
  assert.deepEqual(crossed.crossedRivers, [state.river!.name]);
  assert.ok(travel(crossed).miles > state.miles);
  assert.deepEqual(validateSave(crossed), crossed);
});

test("an unaffordable ferry and invalid crossings cannot advance or debit a journey", () => {
  const state = freeze({ ...atRiver(), money: 0 });
  const blocked = crossRiver(state, "ferry");
  assert.equal(blocked.money, 0);
  assert.equal(blocked.day, state.day);
  assert.equal(blocked.status, "river");
  assert.deepEqual(crossRiver(state, "teleport" as "ford"), state);
  const dry = createGame({ seed: 4 });
  assert.deepEqual(crossRiver(dry, "ferry"), dry);
});

test("caulking takes two days and an affordable ferry never damages the wagon", () => {
  const river = atRiver();
  assert.equal(crossRiver(river, "caulk").day, river.day + 2);
  for (let seed = 1; seed <= 50; seed += 1) {
    const state = { ...river, seed };
    assert.equal(crossRiver(state, "ferry").wagon, state.wagon);
  }
});

test("hunting clamps hits to ammunition and consumes time and daily rations", () => {
  const initial = freeze({ ...createGame({ seed: 10 }), ammunition: 2 });
  const result = hunt(initial, 999);
  assert.equal(result.ammunition, 0);
  assert.equal(result.food, initial.food + 80 - 10);
  assert.equal(result.day, initial.day + 1);
  const negative = hunt(initial, -8);
  assert.equal(negative.food, initial.food - 10);
  assert.equal(hunt(initial, Number.NaN).food, initial.food - 10);
  const empty = { ...initial, ammunition: 0 };
  assert.equal(hunt(empty, 5).day, empty.day);
  const banker = createGame({ seed: 10, profession: "banker" });
  assert.ok(hunt(createGame({ seed: 10 }), 5).food > hunt(banker, 5).food);
});

test("rest heals living travelers, spends food, and does not resurrect the dead", () => {
  const initial = createGame({ seed: 84 });
  initial.members[0] = { name: "Avery", health: 40, alive: true };
  initial.members[1] = { name: "Eli", health: 0, alive: false };
  freeze(initial);
  const result = rest(initial);
  assert.equal(result.day, 3);
  assert.equal(result.food, initial.food - 16);
  assert.equal(result.members[0]!.health, 52);
  assert.deepEqual(result.members[1], initial.members[1]);
  assert.equal(result.miles, 0);
});

test("medicine and parts are only consumed when useful and profession affects repairs", () => {
  const initial = createGame({ seed: 11 });
  assert.equal(heal(initial).medicine, initial.medicine);
  assert.equal(repair(initial).parts, initial.parts);
  initial.members[0]!.health = 60;
  const healed = heal(freeze(initial));
  assert.equal(healed.members[0]!.health, 85);
  assert.equal(healed.medicine, initial.medicine - 1);
  assert.equal(heal({ ...initial, medicine: 0 }).members[0]!.health, 60);
  const farmer = repair({ ...initial, wagon: 20 });
  const carpenter = repair({ ...initial, profession: "carpenter", wagon: 20 });
  assert.equal(farmer.wagon, 55);
  assert.equal(carpenter.wagon, 75);
  assert.equal(repair({ ...initial, wagon: 20, parts: 0 }).wagon, 20);
});

test("trade charges exactly the advertised price and refuses unaffordable or over-cap purchases", () => {
  for (const offer of SHOP) {
    const initial = freeze(createGame({ seed: 12 }));
    const result = trade(initial, offer.item);
    assert.equal(result.money, initial.money - offer.price);
    assert.equal(result[offer.item], initial[offer.item] + offer.amount);
    assert.equal(result.day, initial.day);
    const poor = { ...initial, money: offer.price - 1 };
    const refused = trade(poor, offer.item);
    assert.equal(refused.money, poor.money);
    assert.equal(refused[offer.item], poor[offer.item]);
  }
  const full = { ...createGame({ seed: 12 }), oxen: 8 };
  assert.equal(trade(full, "oxen").money, full.money);
});

test("ration and pace choices change consumption, health, and distance", () => {
  const initial = freeze(createGame({ seed: 321 }));
  const steady = travel(initial);
  const fast = travel(setPace(initial, "grueling"));
  const frugal = travel(setRations(initial, "bare"));
  assert.ok(fast.miles > steady.miles);
  assert.ok(fast.members[0]!.health < steady.members[0]!.health);
  assert.ok(frugal.food > steady.food);
  assert.ok(frugal.members[0]!.health < steady.members[0]!.health);
  assert.equal(initial.pace, "steady");
  assert.equal(initial.rations, "filling");
});

test("starvation can end a journey and every action respects ended games", () => {
  const initial = createGame({ seed: 10 });
  initial.food = 0;
  initial.members.forEach((member) => {
    member.health = 5;
  });
  const ended = travel(initial);
  assert.equal(ended.status, "lost");
  assert.equal(
    ended.members.every((member) => !member.alive),
    true,
  );
  assert.deepEqual(validateSave(ended), ended);
  const actions = [
    travel,
    rest,
    heal,
    repair,
    (state: GameState) => hunt(state, 5),
    (state: GameState) => trade(state, "food"),
    (state: GameState) => crossRiver(state, "ferry"),
    (state: GameState) => setPace(state, "grueling"),
    (state: GameState) => setRations(state, "bare"),
  ];
  freeze(ended);
  for (const action of actions) assert.deepEqual(action(ended), ended);
});

test("a maintained, provisioned party can finish the whole trail across multiple seeds", () => {
  for (const seed of [1, 42, 1848, 321321, 4294967295]) {
    let state = createGame({ seed, profession: "farmer" });
    let steps = 0;
    while (
      (state.status === "traveling" || state.status === "river") &&
      steps < 180
    ) {
      if (state.food < 70) state = hunt(state, 4);
      if (state.ammunition < 5) state = trade(state, "ammunition");
      if (state.wagon < 40) {
        if (state.parts < 1) state = trade(state, "parts");
        state = repair(state);
      }
      if (state.oxen < 4 && state.money >= 50) state = trade(state, "oxen");
      if (state.members.some((member) => member.alive && member.health < 50))
        state = rest(state);
      state =
        state.status === "river"
          ? crossRiver(
              state,
              state.money >= state.river!.ferryCost ? "ferry" : "caulk",
            )
          : travel(state);
      assert.deepEqual(
        validateSave(JSON.parse(JSON.stringify(state))),
        state,
        `save round trip at seed ${seed}, step ${steps}`,
      );
      steps += 1;
    }
    assert.equal(state.status, "won", `seed ${seed} after ${steps} turns`);
    assert.equal(state.miles, TOTAL_MILES);
    assert.equal(state.location, "Oregon City");
    assert.equal(
      state.crossedRivers.length,
      LANDMARKS.filter((point) => point.type === "river").length,
    );
    assert.equal(
      state.log[0]!.title,
      "The West is calling",
      "the completed journal retains the departure",
    );
    assert.equal(state.log[0]!.id, 1);
    if (seed === 42)
      assert.ok(
        state.log.length > 80,
        "the full journey exceeds the old journal limit",
      );
    assert.deepEqual(travel(state), state);
  }
});

test("winter closes the trail and broken wagons cannot reach a false victory", () => {
  const winter = rest({ ...createGame({ seed: 3 }), day: 220 });
  assert.equal(winter.status, "lost");
  assert.equal(winter.day, 221);
  assert.deepEqual(validateSave(winter), winter);
  const initial = createGame({ seed: 3 });
  initial.wagon = 1;
  const broken = travel(initial);
  assert.equal(broken.status, "lost");
  assert.equal(broken.wagon, 0);
});

test("save validation rejects malformed, nonfinite, inconsistent, and future states", () => {
  const valid = createGame({ seed: 123 });
  const invalid: unknown[] = [
    null,
    undefined,
    [],
    "",
    42,
    {},
    { ...valid, version: 2 },
    { ...valid, food: Number.NaN },
    { ...valid, money: Infinity },
    { ...valid, seed: 0 },
    { ...valid, oxen: -1 },
    { ...valid, wagon: 101 },
    { ...valid, day: 0 },
    { ...valid, day: 1.5 },
    { ...valid, members: [] },
    { ...valid, log: null },
    { ...valid, status: "won" },
    { ...valid, status: "lost" },
    { ...valid, status: "river" },
    { ...valid, river: {} },
    { ...valid, location: "Oregon City" },
    { ...valid, crossedRivers: ["Snake River"] },
    { ...valid, pace: "teleport" },
    {
      ...valid,
      members: valid.members.map((member) => ({ ...member, alive: false })),
    },
    { ...valid, log: [{ ...valid.log[0], day: 900 }] },
    { ...valid, log: [{ ...valid.log[0], body: "<".repeat(801) }] },
    {
      ...valid,
      log: Array.from({ length: 2001 }, (_, index) => ({
        ...valid.log[0],
        id: index + 1,
      })),
    },
    { ...valid, miles: 900, location: "Fort Laramie" },
  ];
  for (const value of invalid) assert.equal(validateSave(value), null);
  const river = atRiver();
  assert.equal(
    validateSave({ ...river, river: { ...river.river, depth: Infinity } }),
    null,
  );
  assert.equal(
    validateSave({
      ...river,
      river: { ...river.river, name: "Imaginary River" },
    }),
    null,
  );
  assert.equal(
    validateSave({
      ...river,
      crossedRivers: [river.river!.name, river.river!.name],
    }),
    null,
  );
  const restored = validateSave(valid)!;
  restored.members[0]!.health = 20;
  assert.equal(valid.members[0]!.health, 100);
  assert.deepEqual(
    validateSave({ ...valid, unexpectedField: "discard me" }),
    valid,
  );
});
