export type Pace = "steady" | "strenuous" | "grueling";
export type Rations = "filling" | "meager" | "bare";
export type Profession = "farmer" | "carpenter" | "banker";
export type ShopItem = "food" | "ammunition" | "medicine" | "parts" | "oxen";
export type CrossingMethod = "ford" | "caulk" | "ferry";

export interface PartyMember {
  name: string;
  health: number;
  alive: boolean;
}

export interface JournalEntry {
  id: number;
  day: number;
  title: string;
  body: string;
  kind: "good" | "warning" | "neutral";
}

export interface River {
  name: string;
  depth: number;
  width: number;
  ferryCost: number;
}

export interface GameState {
  version: 1;
  partyName: string;
  profession: Profession;
  members: PartyMember[];
  day: number;
  miles: number;
  food: number;
  money: number;
  ammunition: number;
  medicine: number;
  parts: number;
  oxen: number;
  wagon: number;
  pace: Pace;
  rations: Rations;
  status: "traveling" | "river" | "won" | "lost";
  weather: string;
  location: string;
  log: JournalEntry[];
  river: River | null;
  crossedRivers: string[];
  seed: number;
}

export const TOTAL_MILES = 2040;
export const LANDMARKS: {
  name: string;
  miles: number;
  type: "town" | "fort" | "river" | "landmark" | "destination";
}[] = [
  { name: "Independence", miles: 0, type: "town" },
  { name: "Kansas River", miles: 140, type: "river" },
  { name: "Big Blue River", miles: 230, type: "river" },
  { name: "Fort Kearny", miles: 480, type: "fort" },
  { name: "Chimney Rock", miles: 650, type: "landmark" },
  { name: "Fort Laramie", miles: 830, type: "fort" },
  { name: "Independence Rock", miles: 1020, type: "landmark" },
  { name: "South Pass", miles: 1180, type: "landmark" },
  { name: "Green River", miles: 1260, type: "river" },
  { name: "Fort Bridger", miles: 1360, type: "fort" },
  { name: "Soda Springs", miles: 1510, type: "landmark" },
  { name: "Fort Hall", miles: 1620, type: "fort" },
  { name: "Snake River", miles: 1740, type: "river" },
  { name: "Fort Boise", miles: 1840, type: "fort" },
  { name: "Blue Mountains", miles: 1940, type: "landmark" },
  { name: "Oregon City", miles: TOTAL_MILES, type: "destination" },
];

/** Prices include delivery from passing traders, so supplies are available along the trail. */
export const SHOP: {
  item: ShopItem;
  label: string;
  amount: number;
  price: number;
  unit: string;
}[] = [
  { item: "food", label: "Food", amount: 200, price: 40, unit: "lb" },
  {
    item: "ammunition",
    label: "Ammunition",
    amount: 20,
    price: 25,
    unit: "rounds",
  },
  { item: "medicine", label: "Medicine", amount: 2, price: 35, unit: "kits" },
  { item: "parts", label: "Spare parts", amount: 2, price: 45, unit: "parts" },
  { item: "oxen", label: "Oxen", amount: 1, price: 50, unit: "ox" },
];

const PACES: Pace[] = ["steady", "strenuous", "grueling"];
const RATIONS: Rations[] = ["filling", "meager", "bare"];
const PROFESSIONS: Profession[] = ["farmer", "carpenter", "banker"];
const WEATHER = [
  "Clear skies",
  "Spring rain",
  "Prairie wind",
  "Hot and dry",
  "Cold rain",
  "Snow flurries",
];
const DEFAULT_NAMES = ["You", "Clara", "Henry", "Rose", "Samuel"];
const RESOURCE_LIMIT = 1_000_000;
const FINAL_DAY = 220;
const JOURNAL_LIMIT = 2000;

function copy(state: GameState): GameState {
  return {
    ...state,
    members: state.members.map((member) => ({ ...member })),
    log: state.log.map((entry) => ({ ...entry })),
    river: state.river ? { ...state.river } : null,
    crossedRivers: [...state.crossedRivers],
  };
}

function random(state: GameState): number {
  let value = state.seed | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.seed = value >>> 0;
  return state.seed / 4294967296;
}

function integer(state: GameState, min: number, max: number): number {
  return min + Math.floor(random(state) * (max - min + 1));
}

function entry(
  state: GameState,
  title: string,
  body: string,
  kind: JournalEntry["kind"] = "neutral",
): void {
  const id = (state.log.at(-1)?.id ?? 0) + 1;
  state.log.push({ id, day: state.day, title, body, kind });
  state.log = state.log.slice(-JOURNAL_LIMIT);
}

function active(state: GameState): boolean {
  return state.status === "traveling" || state.status === "river";
}

function living(state: GameState): PartyMember[] {
  return state.members.filter((member) => member.alive);
}

function setHealth(
  state: GameState,
  member: PartyMember,
  amount: number,
): void {
  if (!member.alive) return;
  member.health = Math.max(0, Math.min(100, Math.round(amount)));
  if (member.health === 0) {
    member.alive = false;
    entry(
      state,
      "A farewell on the trail",
      `${member.name} has died. The party carries their memory west.`,
      "warning",
    );
  }
}

function checkEnd(state: GameState): void {
  if (!active(state)) return;
  const reason =
    living(state).length === 0
      ? "No one in your party survived the journey."
      : state.oxen === 0
        ? "Your last ox has been lost. The wagon can travel no farther."
        : state.wagon === 0
          ? "The wagon has broken beyond repair."
          : state.day > FINAL_DAY
            ? "Winter has closed the mountain passes. Your journey has come to an end."
            : null;
  if (reason) {
    state.status = "lost";
    entry(state, "The trail ends here", reason, "warning");
  } else if (state.miles >= TOTAL_MILES) {
    state.status = "won";
    state.location = "Oregon City";
    state.river = null;
    entry(
      state,
      "A new beginning",
      `You made it to Oregon City in ${state.day - 1} days with ${living(state).length} travelers. A new life awaits.`,
      "good",
    );
  }
}

function updateWeather(state: GameState): void {
  const roll = random(state);
  state.weather =
    state.day > 180
      ? roll < 0.55
        ? "Snow flurries"
        : "Cold rain"
      : state.day > 145
        ? roll < 0.5
          ? "Cold rain"
          : "Prairie wind"
        : state.day > 65
          ? roll < 0.45
            ? "Hot and dry"
            : "Clear skies"
          : roll < 0.3
            ? "Spring rain"
            : roll < 0.5
              ? "Prairie wind"
              : "Clear skies";
}

function passDays(
  state: GameState,
  count: number,
  activity: "travel" | "rest" | "hunt" | "cross",
): void {
  let missedMeals = false;
  for (let day = 0; day < count && active(state); day += 1) {
    state.day += 1;
    const needed = Math.ceil(
      living(state).length *
        { filling: 2, meager: 1.4, bare: 0.8 }[state.rations],
    );
    const starvation = state.food < needed;
    state.food = Math.max(0, state.food - needed);
    missedMeals ||= starvation;
    const cold =
      state.weather === "Snow flurries"
        ? 2
        : state.weather === "Cold rain"
          ? 1
          : 0;
    for (const member of living(state)) {
      const nutrition = { filling: 0, meager: -1, bare: -2 }[state.rations];
      const strain =
        activity === "travel"
          ? { steady: 0, strenuous: -1, grueling: -2 }[state.pace]
          : 0;
      const recovery = activity === "rest" ? 6 : 0;
      setHealth(
        state,
        member,
        member.health +
          (starvation ? -7 : nutrition + strain + recovery - cold),
      );
    }
    checkEnd(state);
  }
  if (missedMeals)
    entry(
      state,
      "Empty provisions",
      "There was not enough food for everyone. Hunt or buy supplies before traveling farther.",
      "warning",
    );
}

function updateLocation(state: GameState): void {
  state.location = LANDMARKS.filter(
    (landmark) => landmark.miles <= state.miles,
  ).at(-1)!.name;
}

function encounter(state: GameState): void {
  if (random(state) > 0.38) return;
  const roll = integer(state, 0, 6);
  if (roll === 0) {
    const food = integer(state, 20, 45);
    state.food += food;
    entry(
      state,
      "A patch of wild berries",
      `Your party gathers ${food} lb of food beside the trail.`,
      "good",
    );
  } else if (roll === 1) {
    const member = living(state)[integer(state, 0, living(state).length - 1)]!;
    setHealth(state, member, member.health - integer(state, 12, 22));
    entry(
      state,
      "Fever in camp",
      `${member.name} has fallen ill. Rest or use a medicine kit to help them recover.`,
      "warning",
    );
  } else if (roll === 2) {
    const damage = integer(state, 7, 14);
    state.wagon = Math.max(0, state.wagon - damage);
    entry(
      state,
      "A rough stretch",
      `A rocky descent damages the wagon by ${damage}%. Spare parts can repair it.`,
      "warning",
    );
  } else if (roll === 3) {
    const lost = Math.min(state.food, integer(state, 15, 35));
    state.food -= lost;
    entry(
      state,
      "Spoiled provisions",
      `A leaking barrel ruins ${lost} lb of food.`,
      "warning",
    );
  } else if (roll === 4) {
    for (const member of living(state))
      setHealth(state, member, member.health + 5);
    entry(
      state,
      "Music by the campfire",
      "A fiddle, a warm fire, and familiar songs lift everyone’s spirits.",
      "good",
    );
  } else if (roll === 5 && state.oxen > 1) {
    state.oxen -= 1;
    entry(
      state,
      "An ox wanders off",
      "One ox disappears during the night. Fewer oxen will slow the wagon.",
      "warning",
    );
  } else {
    entry(
      state,
      "Fellow travelers",
      "You share the road with another wagon. Their stories make the miles feel a little shorter.",
    );
  }
  checkEnd(state);
}

export function createGame(
  options: {
    partyName?: string;
    names?: string[];
    profession?: Profession;
    seed?: number;
  } = {},
): GameState {
  const profession = PROFESSIONS.includes(options.profession!)
    ? options.profession!
    : "farmer";
  const seed = Number.isFinite(options.seed)
    ? options.seed! >>> 0 || 1848
    : Math.floor(Math.random() * 4294967295) || 1848;
  const state: GameState = {
    version: 1,
    partyName: options.partyName?.trim().slice(0, 40) || "The Pioneer Party",
    profession,
    members: DEFAULT_NAMES.map((name, index) => ({
      name: options.names?.[index]?.trim().slice(0, 24) || name,
      health: 100,
      alive: true,
    })),
    day: 1,
    miles: 0,
    food: 500,
    money: { farmer: 450, carpenter: 600, banker: 850 }[profession],
    ammunition: 60,
    medicine: 4,
    parts: 3,
    oxen: 4,
    wagon: 100,
    pace: "steady",
    rations: "filling",
    status: "traveling",
    weather: "Clear skies",
    location: "Independence",
    log: [],
    river: null,
    crossedRivers: [],
    seed,
  };
  entry(
    state,
    "The West is calling",
    `${state.partyName} sets out from Independence. Oregon City lies ${TOTAL_MILES.toLocaleString("en-US")} miles to the west.`,
  );
  return state;
}

export function travel(state: GameState): GameState {
  const next = copy(state);
  if (!active(next)) return next;
  if (next.river) {
    entry(
      next,
      "A river ahead",
      `Choose how to cross the ${next.river.name} before continuing.`,
      "warning",
    );
    return next;
  }
  const oldMiles = next.miles;
  updateWeather(next);
  const base = { steady: 18, strenuous: 23, grueling: 28 }[next.pace];
  const oxenFactor = Math.min(1, next.oxen / 4);
  const wagonFactor = next.wagon < 30 ? 0.7 : 1;
  const weatherFactor =
    next.weather === "Snow flurries"
      ? 0.65
      : next.weather.includes("rain")
        ? 0.9
        : 1;
  const distance = Math.max(
    6,
    Math.round(
      (base * 3 + integer(next, -5, 7)) *
        oxenFactor *
        wagonFactor *
        weatherFactor,
    ),
  );
  passDays(next, 3, "travel");
  if (!active(next)) return next;
  next.wagon = Math.max(
    0,
    next.wagon - integer(next, 2, next.pace === "grueling" ? 7 : 5),
  );
  const target = Math.min(TOTAL_MILES, next.miles + distance);
  const river = LANDMARKS.find(
    (landmark) =>
      landmark.type === "river" &&
      landmark.miles > next.miles &&
      landmark.miles <= target &&
      !next.crossedRivers.includes(landmark.name),
  );
  next.miles = river?.miles ?? target;
  updateLocation(next);
  entry(
    next,
    "Westward bound",
    `Traveled ${next.miles - oldMiles} miles over 3 days. ${TOTAL_MILES - next.miles} miles to Oregon City.`,
  );
  for (const landmark of LANDMARKS.filter(
    (point) =>
      point.miles > oldMiles &&
      point.miles <= next.miles &&
      point.type !== "river" &&
      point.type !== "destination",
  )) {
    entry(
      next,
      landmark.name,
      `You reach ${landmark.name}. Take a moment to rest and check your supplies.`,
      "good",
    );
  }
  if (river) {
    next.status = "river";
    next.river = {
      name: river.name,
      depth: integer(next, 20, 65) / 10,
      width: integer(next, 180, 460),
      ferryCost: integer(next, 20, 35),
    };
    entry(
      next,
      "The water’s edge",
      `The ${river.name} is ${next.river.depth} feet deep and ${next.river.width} feet wide. A ferry crossing costs $${next.river.ferryCost}.`,
    );
  }
  checkEnd(next);
  if (active(next)) encounter(next);
  return next;
}

export function rest(state: GameState): GameState {
  const next = copy(state);
  if (!active(next)) return next;
  updateWeather(next);
  passDays(next, 2, "rest");
  if (active(next))
    entry(
      next,
      "Two quiet days",
      "You make camp, tend to the party, and let the oxen rest. Travelers recover health when there is enough food.",
      "good",
    );
  return next;
}

export function hunt(state: GameState, hits: number): GameState {
  const next = copy(state);
  if (!active(next)) return next;
  if (next.ammunition < 1) {
    entry(
      next,
      "No ammunition",
      "Buy ammunition from a trader before hunting.",
      "warning",
    );
    return next;
  }
  const shots = Math.min(5, next.ammunition);
  const safeHits = Number.isFinite(hits)
    ? Math.max(0, Math.min(shots, Math.floor(hits)))
    : 0;
  const food = safeHits * (next.profession === "farmer" ? 40 : 30);
  next.ammunition -= shots;
  next.food = Math.min(RESOURCE_LIMIT, next.food + food);
  updateWeather(next);
  passDays(next, 1, "hunt");
  entry(
    next,
    safeHits ? "A successful hunt" : "An empty game bag",
    `${shots} rounds used. ${food} lb of food brought back to camp. The party ate its daily rations.`,
    safeHits ? "good" : "warning",
  );
  return next;
}

export function crossRiver(
  state: GameState,
  method: CrossingMethod,
): GameState {
  const next = copy(state);
  if (next.status !== "river" || !next.river) return next;
  if (!(["ford", "caulk", "ferry"] as string[]).includes(method)) return next;
  const river = { ...next.river };
  if (method === "ferry" && next.money < river.ferryCost) {
    entry(
      next,
      "The ferry must be paid",
      `You need $${river.ferryCost} for the ferry. Ford the river or caulk the wagon to cross without a ferry fee.`,
      "warning",
    );
    return next;
  }
  if (method === "ferry") next.money -= river.ferryCost;
  passDays(next, method === "caulk" ? 2 : 1, "cross");
  if (!active(next)) return next;
  const risk =
    method === "ferry"
      ? 0
      : method === "caulk"
        ? 0.15 + (river.depth > 5 ? 0.1 : 0)
        : river.depth <= 2.5
          ? 0.12
          : river.depth <= 4
            ? 0.4
            : 0.72;
  if (random(next) < risk) {
    const food = Math.min(next.food, integer(next, 30, 75));
    next.food -= food;
    next.wagon = Math.max(0, next.wagon - integer(next, 10, 25));
    const member = living(next)[integer(next, 0, living(next).length - 1)]!;
    setHealth(next, member, member.health - integer(next, 12, 30));
    entry(
      next,
      "Trouble in the current",
      `The wagon takes on water. ${food} lb of food is lost and ${member.name} is injured, but the party reaches the far bank.`,
      "warning",
    );
  } else {
    entry(
      next,
      "Safely across",
      method === "ferry"
        ? `The ferry carries your party safely over the ${river.name}.`
        : `You ${method === "ford" ? "ford the shallows" : "float the sealed wagon"} and reach the far bank of the ${river.name}.`,
      "good",
    );
  }
  next.crossedRivers.push(river.name);
  next.river = null;
  next.status = "traveling";
  checkEnd(next);
  return next;
}

export function trade(state: GameState, item: ShopItem): GameState {
  const next = copy(state);
  if (!active(next)) return next;
  const offer = SHOP.find((candidate) => candidate.item === item);
  if (!offer) return next;
  if (next.money < offer.price) {
    entry(
      next,
      "Not enough money",
      `${offer.label} costs $${offer.price}. Your party has $${next.money}.`,
      "warning",
    );
    return next;
  }
  const limit = item === "oxen" ? 8 : RESOURCE_LIMIT;
  if (next[item] + offer.amount > limit) {
    entry(
      next,
      "No more room",
      `Your party is already carrying as much ${offer.label.toLowerCase()} as it can.`,
      "warning",
    );
    return next;
  }
  next.money -= offer.price;
  next[item] += offer.amount;
  entry(
    next,
    "A fair trade",
    `Bought ${offer.amount} ${offer.unit} of ${offer.label.toLowerCase()} for $${offer.price}.`,
    "good",
  );
  return next;
}

export function heal(state: GameState): GameState {
  const next = copy(state);
  if (!active(next)) return next;
  if (next.medicine < 1) {
    entry(
      next,
      "The medicine chest is empty",
      "Buy medicine from a trader or rest to recover health.",
      "warning",
    );
    return next;
  }
  if (living(next).every((member) => member.health === 100)) {
    entry(
      next,
      "Everyone is well",
      "Save your medicine for when someone needs it.",
    );
    return next;
  }
  next.medicine -= 1;
  for (const member of living(next))
    setHealth(next, member, member.health + 25);
  entry(
    next,
    "Tending to the party",
    "One medicine kit helps each surviving traveler recover up to 25 health.",
    "good",
  );
  return next;
}

export function repair(state: GameState): GameState {
  const next = copy(state);
  if (!active(next)) return next;
  if (next.parts < 1) {
    entry(
      next,
      "No spare parts",
      "Buy spare parts from a trader to repair your wagon.",
      "warning",
    );
    return next;
  }
  if (next.wagon === 100) {
    entry(
      next,
      "Ready for the road",
      "Your wagon is already in excellent condition.",
    );
    return next;
  }
  const restored = Math.min(
    100 - next.wagon,
    next.profession === "carpenter" ? 55 : 35,
  );
  next.parts -= 1;
  next.wagon += restored;
  entry(
    next,
    "Good as new",
    `One spare part restores ${restored}% wagon condition.`,
    "good",
  );
  return next;
}

export function setPace(state: GameState, pace: Pace): GameState {
  const next = copy(state);
  if (active(next) && PACES.includes(pace)) next.pace = pace;
  return next;
}

export function setRations(state: GameState, rations: Rations): GameState {
  const next = copy(state);
  if (active(next) && RATIONS.includes(rations)) next.rations = rations;
  return next;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function number(
  value: unknown,
  min: number,
  max: number,
  whole = true,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!whole || Number.isInteger(value))
  );
}

function string(value: unknown, max: number): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

/** A saved journey is untrusted input. Reject invalid data before it reaches the UI or simulation. */
export function validateSave(value: unknown): GameState | null {
  try {
    if (!record(value) || value.version !== 1 || !string(value.partyName, 40))
      return null;
    if (
      !PROFESSIONS.includes(value.profession as Profession) ||
      !PACES.includes(value.pace as Pace) ||
      !RATIONS.includes(value.rations as Rations)
    )
      return null;
    if (
      !["traveling", "river", "won", "lost"].includes(value.status as string) ||
      !WEATHER.includes(value.weather as string)
    )
      return null;
    if (
      !number(value.day, 1, FINAL_DAY + 1) ||
      !number(value.miles, 0, TOTAL_MILES) ||
      !number(value.seed, 1, 4294967295)
    )
      return null;
    for (const field of ["food", "money", "ammunition", "medicine", "parts"]) {
      if (!number(value[field], 0, RESOURCE_LIMIT)) return null;
    }
    if (!number(value.oxen, 0, 8) || !number(value.wagon, 0, 100)) return null;
    if (!Array.isArray(value.members) || value.members.length !== 5)
      return null;
    if (
      !value.members.every(
        (member) =>
          record(member) &&
          string(member.name, 24) &&
          number(member.health, 0, 100) &&
          typeof member.alive === "boolean" &&
          member.alive === member.health > 0,
      )
    )
      return null;
    if (
      !Array.isArray(value.log) ||
      value.log.length < 1 ||
      value.log.length > JOURNAL_LIMIT
    )
      return null;
    let lastId = 0;
    let lastDay = 0;
    for (const item of value.log) {
      if (
        !record(item) ||
        !number(item.id, lastId + 1, Number.MAX_SAFE_INTEGER) ||
        !number(item.day, Math.max(1, lastDay), value.day) ||
        !string(item.title, 120) ||
        !string(item.body, 800) ||
        !["good", "warning", "neutral"].includes(item.kind as string)
      )
        return null;
      lastId = item.id;
      lastDay = item.day;
    }
    const knownRivers = LANDMARKS.filter(
      (landmark) => landmark.type === "river",
    );
    if (
      !Array.isArray(value.crossedRivers) ||
      value.crossedRivers.length > knownRivers.length ||
      new Set(value.crossedRivers).size !== value.crossedRivers.length
    )
      return null;
    if (
      !value.crossedRivers.every(
        (name) =>
          typeof name === "string" &&
          knownRivers.some(
            (river) =>
              river.name === name && river.miles <= (value.miles as number),
          ),
      )
    )
      return null;
    if (
      knownRivers.some(
        (river) =>
          river.miles < (value.miles as number) &&
          !(value.crossedRivers as string[]).includes(river.name),
      )
    )
      return null;
    const location = LANDMARKS.filter(
      (landmark) => landmark.miles <= (value.miles as number),
    ).at(-1)!;
    if (value.location !== location.name) return null;
    if (value.river !== null) {
      if (
        !record(value.river) ||
        !knownRivers.some(
          (river) =>
            river.name === (value.river as Record<string, unknown>).name &&
            river.miles === value.miles,
        )
      )
        return null;
      if (
        !number(value.river.depth, 2, 6.5, false) ||
        !number(value.river.width, 180, 460) ||
        !number(value.river.ferryCost, 20, 35)
      )
        return null;
      if (value.status !== "river" && value.status !== "lost") return null;
      if (value.crossedRivers.includes(value.river.name)) return null;
    } else if (value.status === "river") return null;
    if (
      value.status === "traveling" &&
      knownRivers.some(
        (river) =>
          river.miles === value.miles &&
          !(value.crossedRivers as string[]).includes(river.name),
      )
    )
      return null;
    const terminalLoss =
      value.members.every((member) => !(member as PartyMember).alive) ||
      value.oxen === 0 ||
      value.wagon === 0 ||
      value.day > FINAL_DAY;
    if ((value.status === "lost") !== terminalLoss) return null;
    if (
      value.status === "won" &&
      (value.miles !== TOTAL_MILES || value.river !== null)
    )
      return null;
    if (
      value.miles === TOTAL_MILES &&
      value.status !== "won" &&
      value.status !== "lost"
    )
      return null;
    const save = value as unknown as GameState;
    return copy({
      version: 1,
      partyName: save.partyName,
      profession: save.profession,
      members: save.members.map(({ name, health, alive }) => ({
        name,
        health,
        alive,
      })),
      day: save.day,
      miles: save.miles,
      food: save.food,
      money: save.money,
      ammunition: save.ammunition,
      medicine: save.medicine,
      parts: save.parts,
      oxen: save.oxen,
      wagon: save.wagon,
      pace: save.pace,
      rations: save.rations,
      status: save.status,
      weather: save.weather,
      location: save.location,
      log: save.log.map(({ id, day, title, body, kind }) => ({
        id,
        day,
        title,
        body,
        kind,
      })),
      river: save.river
        ? {
            name: save.river.name,
            depth: save.river.depth,
            width: save.river.width,
            ferryCost: save.river.ferryCost,
          }
        : null,
      crossedRivers: save.crossedRivers,
      seed: save.seed,
    });
  } catch {
    return null;
  }
}
