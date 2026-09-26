import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createGame,
  LANDMARKS,
  TOTAL_MILES,
  travel,
  validateSave,
} from "../../src/game.ts";
import type { GameState } from "../../src/game.ts";

const SAVE_KEY = "westward.expedition.v1";

async function savedGame(page: Page): Promise<GameState> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    SAVE_KEY,
  );
}

async function openSavedGame(page: Page, state: GameState): Promise<void> {
  expect(
    validateSave(state),
    "The scenario must be a valid, loadable expedition",
  ).not.toBeNull();
  await page.goto("/");
  await page.evaluate(
    ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
    { key: SAVE_KEY, state },
  );
  await page.reload();
}

test("opens a playable expedition with supplies, party, and an autosave", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "The long way west." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Travel onward/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Your traveling party" }),
  ).toBeVisible();
  await expect(page.getByText("Journey autosaved")).toBeVisible();
  await expect(
    page.getByRole("img", { name: /A covered wagon follows/ }),
  ).toBeVisible();
  const state = await savedGame(page);
  expect(state.members.filter((member) => member.alive)).toHaveLength(5);
  expect(state.food).toBeGreaterThan(0);
  expect(state.miles).toBe(0);
  expect(validateSave(state)).not.toBeNull();
  expect(errors).toEqual([]);
});

test("travel advances time and distance and survives a browser reload", async ({
  page,
}) => {
  await openSavedGame(page, createGame({ seed: 1848 }));
  const before = await savedGame(page);
  await page.getByRole("button", { name: /^Travel onward/ }).click();
  await expect(
    page.getByRole("heading", { name: "Westward bound" }),
  ).toBeVisible();
  const traveled = await savedGame(page);
  expect(traveled.day).toBe(before.day + 3);
  expect(traveled.miles).toBeGreaterThan(before.miles);
  expect(traveled.food).toBeLessThan(before.food);
  await expect(
    page.getByText(`${traveled.miles} miles traveled`, { exact: true }),
  ).toBeVisible();

  await page.reload();
  expect(await savedGame(page)).toEqual(traveled);
  await expect(
    page.getByText(`${traveled.miles} miles traveled`, { exact: true }),
  ).toBeVisible();
});

for (const [description, corruptSave] of [
  ["malformed JSON", "{not valid JSON"],
  [
    "an invalid game shape",
    JSON.stringify({ version: 1, partyName: "Unfinished save", members: [] }),
  ],
]) {
  test(`recovers from ${description} and correctly reports a working autosave`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: SAVE_KEY,
      value: corruptSave,
    });
    await page.reload();

    await expect(
      page.getByText(
        "Your previous save could not be read. A fresh expedition is ready.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Journey autosaved", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Session only", { exact: true }),
    ).not.toBeVisible();
    const recovered = await savedGame(page);
    expect(validateSave(recovered)).not.toBeNull();
    expect(recovered.miles).toBe(0);
    await page.getByRole("button", { name: /^Travel onward/ }).click();
    const traveled = await savedGame(page);
    expect(traveled.miles).toBeGreaterThan(0);
    await page.reload();
    expect(await savedGame(page)).toEqual(traveled);
    await expect(
      page.getByText("Journey autosaved", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Your previous save could not be read/),
    ).not.toBeVisible();
  });
}

test("medicine is available for a wounded traveler even when average health rounds to 100", async ({
  page,
}) => {
  const state = createGame({ seed: 1848 });
  state.members[0].health = 99;
  await openSavedGame(page, state);
  const heal = page.getByRole("button", { name: /^Tend to your party/ });
  await expect(heal).toBeEnabled();
  await heal.click();
  await expect(
    page.getByRole("heading", { name: "Tending to the party" }),
  ).toBeVisible();
  const healed = await savedGame(page);
  expect(healed.members.every((member) => member.health === 100)).toBe(true);
  expect(healed.medicine).toBe(state.medicine - 1);
  expect(healed.day).toBe(state.day);
  await expect(heal).toBeDisabled();
  await page.reload();
  expect(await savedGame(page)).toEqual(healed);
  await expect(heal).toBeDisabled();
});

test("map, journal, and field guide expose the route and saved history", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Travel onward/ }).click();
  await page.getByRole("button", { name: "Trail map", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A country to cross." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Oregon City", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Trail journal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Westward bound" }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Keep a copy" }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(
    "westward-trail-journal.txt",
  );
  await page.getByRole("button", { name: "Field guide", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Wisdom for the road." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Respect the water." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "The journey", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Travel onward/ }),
  ).toBeEnabled();
});

test("new expeditions validate the party and preserve the selected profession", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "New expedition", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your party’s name").fill("The Cedar Party");
  await dialog.getByLabel(/Your five travelers/).fill("Ada, Ben");
  await dialog.getByRole("button", { name: /Let the adventure begin/ }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "exactly five traveler names",
  );
  await dialog
    .getByLabel(/Your five travelers/)
    .fill("Ada, Ben, Clara, Diego, Emi");
  await dialog.getByRole("radio", { name: /Banker/ }).check();
  await dialog.getByRole("button", { name: /Let the adventure begin/ }).click();

  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The Cedar Party" }),
  ).toBeVisible();
  await expect(page.getByText("Banker led expedition")).toBeVisible();
  const state = await savedGame(page);
  expect(state.profession).toBe("banker");
  expect(state.members.map((member) => member.name)).toEqual([
    "Ada",
    "Ben",
    "Clara",
    "Diego",
    "Emi",
  ]);
  expect(state.money).toBe(createGame({ profession: "banker" }).money);
  await page.reload();
  await expect(page.getByText("Banker led expedition")).toBeVisible();
  expect(await savedGame(page)).toEqual(state);
});

test("buying food updates supplies, money, journal, and affordability", async ({
  page,
}) => {
  const state = createGame({ seed: 1848 });
  state.money = 40;
  await openSavedGame(page, state);
  await page.getByRole("button", { name: /^Trade supplies/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Buy · $40", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("200 lb · carrying 700"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Buy · $40", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Buy · $25", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("heading", { name: "A fair trade" }),
  ).toBeVisible();
  const purchased = await savedGame(page);
  expect(purchased.food).toBe(state.food + 200);
  expect(purchased.money).toBe(0);
  expect(purchased.day).toBe(state.day);
  await page.reload();
  expect(await savedGame(page)).toEqual(purchased);
});

test("pace and rations remain selected after navigation and reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Travel pace").selectOption("strenuous");
  await page.getByLabel("Food rations").selectOption("meager");
  await expect(
    page.getByText("More miles. Less time to catch your breath."),
  ).toBeVisible();
  await expect(
    page.getByText("Stretch your stores at a cost to health."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Trail map", exact: true }).click();
  await page.getByRole("button", { name: "The journey", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Travel pace")).toHaveValue("strenuous");
  await expect(page.getByLabel("Food rations")).toHaveValue("meager");
  expect(await savedGame(page)).toMatchObject({
    pace: "strenuous",
    rations: "meager",
  });
});

test("the ferry clears a blocking river and charges the displayed fare", async ({
  page,
}) => {
  let state = createGame({ seed: 1848 });
  for (let i = 0; i < 10 && state.status !== "river"; i++)
    state = travel(state);
  expect(state.status).toBe("river");
  const river = state.river!;
  await openSavedGame(page, state);
  await expect(
    page.getByRole("button", { name: /^Travel onward/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /^Plan your crossing/ }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: river.name }),
  ).toBeVisible();
  const ferry = page.getByRole("button", { name: /^Take the ferry/ });
  await expect(ferry).toContainText(`$${river.ferryCost}`);
  await ferry.click();
  await expect(
    page.getByRole("heading", { name: "Safely across" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Travel onward/ }),
  ).toBeEnabled();
  const crossed = await savedGame(page);
  expect(crossed.money).toBe(state.money - river.ferryCost);
  expect(crossed.day).toBe(state.day + 1);
  expect(crossed.river).toBeNull();
  expect(crossed.crossedRivers).toContain(river.name);
  await page.reload();
  expect(await savedGame(page)).toEqual(crossed);
});

test("hunting accepts mouse and keyboard shots and saves food and ammunition costs", async ({
  page,
}) => {
  const state = createGame({ seed: 1848 });
  await openSavedGame(page, state);
  await page.getByRole("button", { name: /^Go hunting/ }).click();
  const deer = page.getByRole("button", { name: "Aim and fire at the deer" });
  await deer.click();
  await expect(page.locator("#hunt-hits")).toHaveText("1 / 5");
  await deer.focus();
  await deer.press("Enter");
  await deer.press("Space");
  await deer.press("Enter");
  await deer.press("Space");
  await expect(
    page.getByRole("heading", { name: "Back by the campfire." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("5 successful shots");
  const hunted = await savedGame(page);
  expect(hunted.day).toBe(state.day + 1);
  expect(hunted.ammunition).toBe(state.ammunition - 5);
  expect(hunted.food).toBe(state.food + 200 - 10);
  await page.getByRole("button", { name: /^Return to the journey/ }).click();
  await page.reload();
  expect(await savedGame(page)).toEqual(hunted);
});

test("ending a hunt early still costs a day and cartridges", async ({
  page,
}) => {
  const state = createGame({ seed: 1848 });
  await openSavedGame(page, state);
  await page.getByRole("button", { name: /^Go hunting/ }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Some days, the wild wins." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("0 successful shots");
  expect(await savedGame(page)).toMatchObject({
    day: state.day + 1,
    ammunition: state.ammunition - 5,
    food: state.food - 10,
  });
});

for (const outcome of ["won", "lost"] as const) {
  test(`${outcome === "won" ? "reaching Oregon" : "a broken wagon"} ends play but keeps the journal and restart available`, async ({
    page,
  }) => {
    const state = createGame({ seed: 1848 });
    if (outcome === "won") {
      state.miles = TOTAL_MILES - 10;
      state.location = "Blue Mountains";
      state.crossedRivers = LANDMARKS.filter(
        (landmark) => landmark.type === "river",
      ).map((landmark) => landmark.name);
    } else {
      state.wagon = 1;
    }
    await openSavedGame(page, state);
    await page.getByRole("button", { name: /^Travel onward/ }).click();
    await expect(
      page.getByRole("heading", {
        name:
          outcome === "won" ? "Oregon, at last." : "Your journey has ended.",
      }),
    ).toBeVisible();
    for (const name of [
      /^Travel onward/,
      /^Make camp/,
      /^Go hunting/,
      /^Trade supplies/,
      /^Tend to your party/,
      /^Repair wagon/,
    ]) {
      await expect(page.getByRole("button", { name })).toBeDisabled();
    }
    await expect(page.getByLabel("Travel pace")).toBeDisabled();
    await expect(page.getByLabel("Food rations")).toBeDisabled();
    expect((await savedGame(page)).status).toBe(outcome);
    await page.reload();
    await expect(
      page.getByRole("button", { name: /^Start a new story/ }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Trail journal", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: outcome === "won" ? "A new beginning" : "The trail ends here",
      }),
    ).toBeVisible();
  });
}

test("mobile layout fits the viewport and provides named navigation and restart", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const [navigation, heading] of [
    ["Trail map", "A country to cross."],
    ["Trail journal", "Stories from the trail."],
    ["Field guide", "Wisdom for the road."],
    ["The journey", "The long way west."],
  ]) {
    await page.getByRole("button", { name: navigation, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  }
  await page
    .getByRole("button", { name: "New expedition", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
