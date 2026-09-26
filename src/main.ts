import "./style.css";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/dm-serif-display/latin-400.css";
import "@fontsource/dm-serif-display/latin-400-italic.css";
import {
  createGame,
  travel,
  rest,
  hunt,
  crossRiver,
  trade,
  heal,
  repair,
  setPace,
  setRations,
  validateSave,
  LANDMARKS,
  TOTAL_MILES,
  SHOP,
} from "./game.ts";
import type { GameState, Pace, Rations, Profession } from "./game.ts";
import { icon } from "./icons.ts";

type View = "journey" | "map" | "journal" | "guide";
const SAVE_KEY = "westward.expedition.v1";
const app = document.querySelector<HTMLDivElement>("#app")!;
let view: View = "journey";
let storageMessage = "";
let savingAvailable = true;
let state = loadGame();
let hunting: {
  hits: number;
  seconds: number;
  shots: number;
  timer: ReturnType<typeof setInterval> | null;
} | null = null;

function loadGame(): GameState {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(SAVE_KEY);
  } catch {
    savingAvailable = false;
    storageMessage =
      "Saving is unavailable in this browser. Your expedition will last for this session.";
  }
  if (saved) {
    try {
      const parsed = validateSave(JSON.parse(saved));
      if (parsed) return parsed;
    } catch {
      /* An invalid JSON save is recoverable; storage may still work. */
    }
    storageMessage =
      "Your previous save could not be read. A fresh expedition is ready.";
  }
  return createGame({
    partyName: "The Hawthorne party",
    names: ["Thomas", "Eleanor", "William", "Charlotte", "Henry"],
  });
}

function saveGame(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    savingAvailable = true;
    if (storageMessage.startsWith("Saving is unavailable")) storageMessage = "";
  } catch {
    savingAvailable = false;
    storageMessage =
      "Saving is unavailable in this browser. Keep this tab open to continue your expedition.";
  }
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const number = (value: number) => Math.round(value).toLocaleString("en-US");
const living = () => state.members.filter((member) => member.alive);
const health = () =>
  living().length
    ? Math.round(
        living().reduce((sum, member) => sum + member.health, 0) /
          living().length,
      )
    : 0;
const condition = (value: number) =>
  value >= 75 ? "Good" : value >= 45 ? "Fair" : value > 0 ? "Poor" : "Lost";
const ended = () => state.status === "won" || state.status === "lost";
const progress = () => Math.min(100, (state.miles / TOTAL_MILES) * 100);
function date(short = false, day = state.day): string {
  const date = new Date(Date.UTC(1848, 3, day));
  return date.toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    day: "numeric",
    ...(short ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
const nextStop = () =>
  LANDMARKS.find((landmark) => landmark.miles > state.miles) ??
  LANDMARKS[LANDMARKS.length - 1];
const weatherIcon = () =>
  /rain|storm|snow/i.test(state.weather)
    ? "rain"
    : /cloud|overcast/i.test(state.weather)
      ? "cloud"
      : "sun";

function render(): void {
  const titles: Record<View, [string, string]> = {
    journey: [
      "The long way west.",
      "A little courage. A covered wagon. A whole new beginning.",
    ],
    map: [
      "A country to cross.",
      "Follow the rivers, find the passes, and keep your eyes on Oregon.",
    ],
    journal: [
      "Stories from the trail.",
      "The small victories and hard lessons of your expedition.",
    ],
    guide: [
      "Wisdom for the road.",
      "A few things worth knowing before the next mile.",
    ],
  };
  app.innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="#journey" aria-label="Westward home" data-view="journey">
        <span class="brand-mark">${icon("wagon")}</span><span>WESTWARD<small>THE OREGON TRAIL</small></span>
      </a>
      <div class="sidebar-rule"></div>
      <div class="eyebrow nav-label">YOUR EXPEDITION</div>
      <nav aria-label="Main navigation">
        ${(
          [
            ["journey", "trail", "The journey"],
            ["map", "map", "Trail map"],
            ["journal", "book", "Trail journal"],
            ["guide", "compass", "Field guide"],
          ] as const
        )
          .map(
            ([id, symbol, label]) =>
              `<button class="nav-link ${view === id ? "active" : ""}" data-view="${id}" aria-label="${label}" ${view === id ? 'aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span>${view === id ? '<span class="nav-dot"></span>' : ""}</button>`,
          )
          .join("")}
      </nav>
      <div class="sidebar-destination">
        <div class="destination-sketch">${icon("mountain")}<span>WEST IS A<br>STATE OF MIND.</span></div>
        <div class="eyebrow">OREGON OR BUST</div>
        <p>${number(TOTAL_MILES - state.miles)} miles of possibility.</p>
        <div class="progress-bar"><i style="width:${progress()}%"></i></div>
        <div class="sidebar-distance"><span>Independence</span><span>Oregon City</span></div>
      </div>
      <div class="sidebar-bottom"><button class="new-expedition" data-action="new">${icon("plus")} New expedition</button><span class="edition">AN ADVENTURE IN 1848 <span>✦</span></span></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb">The frontier ${icon("chevron")} <span>${escape(state.partyName)}</span></div><div class="topbar-actions"><div class="saved-indicator"><span class="status-dot"></span>${savingAvailable ? "Journey autosaved" : "Session only"}</div><button class="mobile-new icon-button" data-action="new" aria-label="New expedition">${icon("plus")}</button></div></header>
      <main id="main-content">
        <div class="page-heading"><div><div class="eyebrow">${ended() ? "AN EXPEDITION TO REMEMBER" : "YOUR STORY IS STILL UNFOLDING"}</div><h1>${titles[view][0]}</h1><p>${titles[view][1]}</p></div><div class="date-box">${icon("sun")}<div><strong>${date()}</strong><span>DAY ${String(state.day).padStart(2, "0")} ON THE TRAIL</span></div></div></div>
        ${storageMessage ? `<div class="notice">${icon("info")}${escape(storageMessage)}</div>` : ""}
        ${view === "journey" ? journeyView() : view === "map" ? mapView() : view === "journal" ? journalView() : guideView()}
        <footer class="page-footer"><span>${icon("compass")} Take care of your people. The miles will follow.</span><span>INDEPENDENCE, MO <span class="footer-arrow">⟶</span> OREGON CITY, OR</span></footer>
      </main>
    </div>
    <dialog id="game-dialog" aria-labelledby="dialog-title"></dialog>`;
  document
    .querySelector("#game-dialog")!
    .addEventListener("cancel", (event) => {
      if (hunting) {
        event.preventDefault();
        finishHunt();
      }
    });
}

function journeyView(): string {
  const next = nextStop();
  const foodDays = Math.floor(
    state.food /
      Math.max(
        1,
        Math.ceil(
          living().length *
            (state.rations === "filling"
              ? 2
              : state.rations === "meager"
                ? 1.4
                : 0.8),
        ),
      ),
  );
  return `
    <div class="journey-grid"><div class="journey-main">
      <section class="landscape-card" aria-label="Illustrated view of the trail">
        <img src="/trail-landscape.svg" alt="A covered wagon follows a winding trail through golden prairie, with a river and mountains on the horizon." />
        <div class="landscape-caption"><span class="eyebrow">${ended() ? "THE END OF THE TRAIL" : "SOMEWHERE BETWEEN HERE & A NEW LIFE"}</span><h2>${state.status === "won" ? "You made it<br>to Oregon." : state.status === "lost" ? "Every journey<br>leaves a story." : "The horizon<br>is calling."}</h2></div>
        <span class="weather-pill">${icon(weatherIcon())}${escape(state.weather)}</span>
        <div class="landscape-bottom"><span>${icon("flag")} ${escape(state.location)}</span><span>${number(state.miles)} miles traveled</span></div>
      </section>
      <section class="route-card" aria-label="Journey progress"><div class="route-top"><div><span class="eyebrow">NEXT ON THE TRAIL</span><h3>${escape(next.name)} ${icon("arrow")}</h3></div><div class="next-distance"><strong>${number(Math.max(0, next.miles - state.miles))}</strong> miles away</div></div><div class="route-track"><span class="route-start"></span><div class="route-fill" style="width:${progress()}%"></div><span class="wagon-position" style="left:clamp(12px, ${progress()}%, calc(100% - 12px))">${icon("wagon")}</span>${[25, 50, 75, 100].map((p) => `<span class="route-point ${progress() >= p ? "passed" : ""}" style="left:${p}%"></span>`).join("")}</div><div class="route-labels"><span>Independence</span><span>${Math.round(progress())}% of the way</span><span>Oregon City</span></div></section>
      ${statusPanel()}
      <section class="action-section"><div class="section-heading"><h2>Make your next move</h2><span class="muted small">Every decision leaves a trail.</span></div><div class="action-grid">
        <button class="action-card primary" data-action="travel" ${ended() || state.status === "river" ? "disabled" : ""}><span class="action-symbol">${icon("wagon")}</span><strong>Travel onward ${icon("arrow")}</strong><small>Hit the trail · 3 days</small></button>
        <button class="action-card" data-action="rest" ${ended() ? "disabled" : ""}><span class="action-symbol">${icon("camp")}</span><strong>Make camp</strong><small>Rest & recover · 2 days</small></button>
        <button class="action-card" data-action="hunt" ${ended() || state.ammunition < 5 ? "disabled" : ""}><span class="action-symbol">${icon("target")}</span><strong>Go hunting</strong><small>Find provisions · 1 day</small></button>
        <button class="action-card" data-action="trade" ${ended() ? "disabled" : ""}><span class="action-symbol">${icon("store")}</span><strong>Trade supplies</strong><small>Visit a trail trader</small></button>
      </div></section>
      <section class="supplies-section"><div class="section-heading"><h2>What you’re carrying</h2><button class="text-button" data-action="supplies">View supplies ${icon("arrow")}</button></div><div class="resource-grid">
        ${resource("food", "Food", number(state.food), "lbs", `About ${foodDays} days left`, state.food < 100)}
        ${resource("coin", "Money", "$" + number(state.money), "", "For the road ahead")}
        ${resource("ammo", "Ammunition", number(state.ammunition), "rounds", "Make every shot count", state.ammunition < 10)}
        ${resource("heart", "Party health", condition(health()), "", `${living().length} travelers · ${health()}% health`, health() < 45)}
      </div></section>
      <section class="recent-journal"><div class="section-heading"><h2>A page from your journal</h2><button class="text-button" data-view="journal">All entries ${icon("arrow")}</button></div>${journalEntries(3)}</section>
    </div><aside class="expedition-panel">
      <section class="party-card"><div class="section-heading"><h2>Your traveling party</h2>${icon("heart")}</div><div class="party-title"><span class="party-monogram">${escape(state.partyName.replace(/^the /i, "").slice(0, 1).toUpperCase())}</span><div><h3>${escape(state.partyName)}</h3><p>${state.profession.charAt(0).toUpperCase() + state.profession.slice(1)} led expedition</p></div></div><div class="party-list">${state.members.map((member, index) => `<div class="party-member"><span class="avatar avatar-${index}">${escape(member.name.slice(0, 1))}</span><span class="member-info"><strong>${escape(member.name)}</strong><small>${member.alive ? condition(member.health) + " health" : "Remembered always"}</small></span><span class="member-health ${member.health < 45 ? "low" : ""}">${member.alive ? `<i style="width:${member.health}%"></i>` : "<span>—</span>"}</span></div>`).join("")}</div><button class="button secondary full-width" data-action="heal" ${ended() || state.medicine < 1 || living().every((member) => member.health === 100) ? "disabled" : ""}>${icon("medical")} Tend to your party <span>${state.medicine}</span></button></section>
      <section class="settings-card"><h2>Set your rhythm</h2><div class="setting-label"><label for="pace">Travel pace</label>${icon("trail")}</div><select id="pace" ${ended() ? "disabled" : ""}><option value="steady" ${state.pace === "steady" ? "selected" : ""}>Steady & sensible</option><option value="strenuous" ${state.pace === "strenuous" ? "selected" : ""}>Strenuous</option><option value="grueling" ${state.pace === "grueling" ? "selected" : ""}>Grueling</option></select><p class="setting-hint">${state.pace === "steady" ? "A little slower. A little kinder." : state.pace === "strenuous" ? "More miles. Less time to catch your breath." : "Fast miles take a heavy toll on health."}</p><div class="setting-label"><label for="rations">Food rations</label>${icon("food")}</div><select id="rations" ${ended() ? "disabled" : ""}><option value="filling" ${state.rations === "filling" ? "selected" : ""}>Filling meals</option><option value="meager" ${state.rations === "meager" ? "selected" : ""}>Meager meals</option><option value="bare" ${state.rations === "bare" ? "selected" : ""}>Bare bones</option></select><p class="setting-hint">${state.rations === "filling" ? "Full bellies make for better days." : state.rations === "meager" ? "Stretch your stores at a cost to health." : "An emergency measure. Hunger takes its toll."}</p></section>
      <section class="wagon-card"><div class="section-heading"><h2>Wagon & team</h2>${icon("wagon")}</div><div class="wagon-condition"><span>Wagon condition</span><strong>${Math.round(state.wagon)}%</strong></div><div class="progress-bar ${state.wagon < 35 ? "danger" : ""}"><i style="width:${state.wagon}%"></i></div><div class="wagon-stats"><span><strong>${state.oxen}</strong> oxen</span><span><strong>${state.parts}</strong> spare parts</span></div><button class="text-button" data-action="repair" ${ended() || state.parts < 1 || state.wagon >= 100 ? "disabled" : ""}>${icon("wrench")} Repair wagon</button></section>
      <div class="trail-tip">${icon("leaf")}<p>“It’s not the miles that make the journey. It’s the people beside you.”</p><span>A LITTLE TRAIL WISDOM</span></div>
    </aside></div>`;
}

function resource(
  symbol: string,
  label: string,
  value: string,
  unit: string,
  note: string,
  warning = false,
): string {
  return `<div class="resource-card ${warning ? "resource-warning" : ""}"><span class="resource-label">${icon(symbol)}${label}</span><div class="resource-value">${value}<span>${unit}</span></div><small>${note}</small></div>`;
}

function statusPanel(): string {
  if (state.status === "river" && state.river)
    return `<section class="event-banner river-banner">${icon("river")}<div><span class="eyebrow">A RIVER STANDS BETWEEN YOU & THE WEST</span><h2>${escape(state.river.name)}</h2><p>${state.river.width} feet across. ${state.river.depth} feet deep. Choose your crossing carefully.</p></div><button class="button" data-action="cross">Plan your crossing ${icon("arrow")}</button></section>`;
  if (ended())
    return `<section class="event-banner ${state.status === "won" ? "win-banner" : "loss-banner"}">${icon(state.status === "won" ? "flag" : "book")}<div><span class="eyebrow">${state.status === "won" ? "WELCOME TO YOUR NEW BEGINNING" : "THE TRAIL WILL REMEMBER YOU"}</span><h2>${state.status === "won" ? "Oregon, at last." : "Your journey has ended."}</h2><p>${number(state.miles)} miles · ${state.day} days · ${living().length} survivors. ${state.status === "won" ? "You brought your people across the frontier." : "Read your journal, learn from the road, and try again."}</p></div><button class="button" data-action="new">Start a new story ${icon("arrow")}</button></section>`;
  if (state.food < 80 || health() < 35 || state.wagon < 25)
    return `<div class="notice warning">${icon("info")}<span>${state.food < 80 ? "Food is running low. Hunt or trade before the next stretch." : state.wagon < 25 ? "Your wagon is close to breaking. Use a spare part to repair it." : "Your party needs care. Make camp or use medicine before pushing on."}</span></div>`;
  if (state.day >= 180)
    return `<div class="notice warning">${icon("clock")}<span>Winter is approaching. Reach Oregon by day 220 — you have ${Math.max(0, 220 - state.day)} days left before the passes close.</span></div>`;
  return "";
}

function journalEntries(limit = Infinity): string {
  return `<div class="journal-list">${[...state.log]
    .reverse()
    .slice(0, limit)
    .map(
      (entry) =>
        `<article class="journal-entry"><span class="journal-icon ${entry.kind}">${icon(entry.kind === "warning" ? "info" : entry.kind === "good" ? "leaf" : "book")}</span><div><div class="journal-entry-title"><h3>${escape(entry.title)}</h3><time>DAY ${entry.day} · ${date(true, entry.day).toUpperCase()}</time></div><p>${escape(entry.body)}</p></div></article>`,
    )
    .join("")}</div>`;
}

function mapView(): string {
  return `<section class="map-hero"><img src="/trail-landscape.svg" alt="The sweeping western landscape"/><div><span class="eyebrow">2,040 MILES. ONE EXTRAORDINARY JOURNEY.</span><h2>Follow your own<br>way west.</h2></div></section><div class="map-layout"><section class="map-stops"><div class="section-heading"><h2>The overland route</h2><span class="badge">${Math.round(progress())}% COMPLETE</span></div>${LANDMARKS.map((stop, index) => `<div class="map-stop ${state.miles >= stop.miles ? "reached" : ""} ${nextStop().name === stop.name && state.miles < TOTAL_MILES ? "next" : ""}"><span class="map-stop-symbol">${icon(state.miles >= stop.miles ? "check" : stop.type === "river" ? "river" : stop.type === "destination" ? "flag" : stop.type === "fort" || stop.type === "town" ? "store" : "mountain")}</span><div><span class="eyebrow">${index === 0 ? "THE BEGINNING" : stop.type.toUpperCase()}</span><h3>${escape(stop.name)}</h3><p>${state.miles >= stop.miles ? "Reached" : nextStop().name === stop.name ? "Your next landmark" : "Further down the trail"}</p></div><span class="stop-miles">${number(stop.miles)}<small>MILES</small></span></div>`).join("")}</section><aside class="map-notes"><span class="eyebrow">YOUR BEARINGS</span><h2>A long road.<br>A worthy destination.</h2><p>The route follows a simplified version of the historic overland trail. Landmarks offer a sense of progress; rivers bring a decision.</p><div class="map-summary"><span>Distance covered<strong>${number(state.miles)} mi</strong></span><span>Distance remaining<strong>${number(TOTAL_MILES - state.miles)} mi</strong></span><span>Days on the trail<strong>${state.day}</strong></span></div><button class="button full-width" data-view="journey">Back to the journey ${icon("arrow")}</button></aside></div>`;
}

function journalView(): string {
  return `<section class="journal-page"><div class="journal-page-heading"><div><span class="eyebrow">THE COLLECTED MEMORIES OF</span><h2>${escape(state.partyName)}</h2></div><button class="button secondary" data-action="download">${icon("download")} Keep a copy</button></div>${journalEntries()}</section>`;
}

function guideView(): string {
  const guides = [
    [
      "wagon",
      "01",
      "Keep moving. Keep everyone alive.",
      "Lead your party from Independence to Oregon City, 2,040 miles away. Travel advances up to three days at a time, stopping at a river when one blocks the road. Reach Oregon with at least one living traveler by day 220. On day 221, winter closes the passes and ends the expedition.",
    ],
    [
      "food",
      "02",
      "A full wagon is a good beginning.",
      "Food is consumed each day, including while camping and hunting. Filling meals protect health; meager and bare rations save food but weaken your party. Hunt or trade well before the food runs out.",
    ],
    [
      "camp",
      "03",
      "Rest is part of the journey.",
      "A steady pace is easiest on your party. Harder paces cover more ground but reduce health faster. Making camp uses two days and helps people recover when they have enough food. Medicine provides immediate care.",
    ],
    [
      "river",
      "04",
      "Respect the water.",
      "Fording is free, but deep water is dangerous. Caulking the wagon has a risk of its own. Paying for a ferry offers the safest crossing. Failed crossings can cost food, supplies, wagon condition, and health.",
    ],
    [
      "target",
      "05",
      "Take only what you can carry.",
      "Hunting takes one day and five cartridges. Click the moving deer or focus it and press Enter or Space. You have twenty seconds and eight attempts; up to five hits bring food home. Leaving the hunt early still uses the day and ammunition.",
    ],
    [
      "wrench",
      "06",
      "Mind the wheels and the weather.",
      "Travel wears down the wagon, and storms can make the road harder. Spare parts restore the wagon; oxen keep you moving. Trade with trail traders for replacements. A ruined wagon, no oxen, or losing your whole party ends the journey.",
    ],
    [
      "coin",
      "07",
      "Choose the life you leave behind.",
      "A new expedition lets you choose a profession. Farmers bring home more food from each hunt, carpenters have a knack for repairs, and bankers start with more money. Each offers a different way to face the same road.",
    ],
    [
      "book",
      "08",
      "Your story stays with you.",
      "The game saves automatically in this browser after every decision. Come back to the same address and browser to continue. A new expedition replaces your current one. You can download your trail journal as a keepsake.",
    ],
  ];
  return `<div class="guide-intro">${icon("compass")}<div><h2>Prepare for the miles ahead.</h2><p>A survival game about planning, luck, and knowing when to slow down.</p></div></div><div class="guide-grid">${guides.map(([symbol, num, title, body]) => `<article class="guide-card"><span class="guide-icon">${icon(symbol)}</span><span class="guide-number">${num}</span><h3>${title}</h3><p>${body}</p></article>`).join("")}</div><div class="historical-note"><strong>A note on the setting</strong><p>This is an original, fictionalized homage to the classic educational game. The real trail crossed Indigenous homelands and was part of a complex, often devastating history of westward expansion. This simplified survival game is not a complete account of that history.</p></div>`;
}

function update(next: GameState): void {
  const focusedAction = (document.activeElement as HTMLElement | null)?.dataset
    .action;
  const previous = state;
  state = next;
  saveGame();
  render();
  if (focusedAction)
    document
      .querySelector<HTMLButtonElement>(
        `button[data-action="${CSS.escape(focusedAction)}"]:not(:disabled)`,
      )
      ?.focus({ preventScroll: true });
  const latest = state.log[state.log.length - 1];
  const message =
    latest && latest.id !== previous.log[previous.log.length - 1]?.id
      ? latest.title + ". " + latest.body
      : "Expedition updated.";
  document.querySelector("#announcer")!.textContent = message;
}

function showDialog(title: string, content: string, className = ""): void {
  const dialog = document.querySelector<HTMLDialogElement>("#game-dialog")!;
  dialog.className = className;
  dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">A WESTWARD EXPEDITION</span><h2 id="dialog-title">${title}</h2></div><button class="icon-button" data-action="close" aria-label="Close dialog">${icon("close")}</button></div>${content}`;
  if (!dialog.open) dialog.showModal();
}

function newExpedition(): void {
  showDialog(
    "Every journey starts somewhere.",
    `<p class="dialog-description">Gather your people. Pack your hopes. Oregon is waiting.<br>Starting replaces your current saved expedition.</p><form id="new-expedition-form"><label class="form-label" for="party-name">Your party’s name</label><input id="party-name" name="partyName" maxlength="32" value="The Hawthorne party" required /><div class="form-label">Who were you back home?</div><div class="profession-options"><label><input type="radio" name="profession" value="farmer" checked/><span>${icon("leaf")}<strong>Farmer</strong><small>Expert hunter</small></span></label><label><input type="radio" name="profession" value="carpenter"/><span>${icon("wrench")}<strong>Carpenter</strong><small>Better repairs</small></span></label><label><input type="radio" name="profession" value="banker"/><span>${icon("coin")}<strong>Banker</strong><small>More money</small></span></label></div><label class="form-label" for="member-names">Your five travelers <span>(separate with commas)</span></label><input id="member-names" name="names" maxlength="140" value="Thomas, Eleanor, William, Charlotte, Henry" required/><p class="form-hint" id="form-error" role="alert">A little company makes a long road feel shorter.</p><button class="button full-width" type="submit">Let the adventure begin ${icon("arrow")}</button></form>`,
  );
}

function shopDialog(): void {
  showDialog(
    "A little something for the road.",
    `<div class="shop-intro"><p>Trail traders have the essentials.<br>Stock up before the next stretch.</p><span class="money-badge">${icon("coin")} $${number(state.money)}</span></div><div class="shop-list">${SHOP.map((item) => `<div class="shop-item"><span class="shop-icon">${icon(item.item === "food" ? "food" : item.item === "ammunition" ? "ammo" : item.item === "medicine" ? "medical" : item.item === "parts" ? "wrench" : "wagon")}</span><div><strong>${escape(item.label)}</strong><small>${item.amount} ${escape(item.unit)} · carrying ${number(state[item.item])}</small></div><button class="button secondary" data-buy="${item.item}" ${state.money < item.price || ended() ? "disabled" : ""}>Buy · $${item.price}</button></div>`).join("")}</div><p class="dialog-footnote">Trading takes no time. Your purchases are saved immediately.</p>`,
  );
}

function suppliesDialog(): void {
  showDialog(
    "Everything in your wagon.",
    `<div class="inventory-grid">${[
      ["food", "Food", `${number(state.food)} lbs`],
      ["coin", "Money", `$${number(state.money)}`],
      ["ammo", "Ammunition", `${state.ammunition} rounds`],
      ["medical", "Medicine", `${state.medicine} doses`],
      ["wrench", "Spare parts", `${state.parts} parts`],
      ["wagon", "Oxen", `${state.oxen} oxen`],
    ]
      .map(
        ([symbol, label, value]) =>
          `<div>${icon(symbol)}<span>${label}</span><strong>${value}</strong></div>`,
      )
      .join(
        "",
      )}</div><button class="button full-width" data-action="trade" ${ended() ? "disabled" : ""}>Visit a trail trader ${icon("arrow")}</button>`,
  );
}

function riverDialog(): void {
  if (!state.river) return;
  showDialog(
    "The water has the final say.",
    `<div class="river-detail">${icon("river")}<h3>${escape(state.river.name)}</h3><p>${state.river.width} feet wide · ${state.river.depth} feet deep</p></div><p class="dialog-description">Your party has reached the river. Fording and the ferry take one day; caulking takes two. Deep water makes a ford especially risky.</p><div class="crossing-options"><button data-cross="ford"><span>${icon("wagon")}<strong>Ford the river</strong><small>Take the wagon through the water. ${state.river.depth > 3 ? "High risk at this depth." : "Risk depends on water depth."}</small></span><b>Free ${icon("arrow")}</b></button><button data-cross="caulk"><span>${icon("wrench")}<strong>Caulk & float</strong><small>Seal the wagon and float across. Two days; moderate risk.</small></span><b>Free ${icon("arrow")}</b></button><button data-cross="ferry" ${state.money < state.river.ferryCost ? "disabled" : ""}><span>${icon("river")}<strong>Take the ferry</strong><small>The safest passage for your party.</small></span><b>$${state.river.ferryCost} ${icon("arrow")}</b></button></div>`,
  );
}

function startHunt(): void {
  if (ended() || state.ammunition < 5) return;
  showDialog(
    "Quiet feet. Steady hands.",
    `<p class="dialog-description">Click the deer to bring food back to camp. You can also use Tab, then Enter or Space. This hunt uses <strong>1 day and 5 cartridges</strong>.</p><div class="hunt-stats"><span>TIME <strong id="hunt-time">20s</strong></span><span>HITS <strong id="hunt-hits">0 / 5</strong></span><span>ATTEMPTS <strong id="hunt-shots">8</strong></span></div><div class="hunting-field" id="hunting-field"><div class="hunt-shade"></div><button class="deer-target" id="deer-target" aria-label="Aim and fire at the deer" style="left:40%;top:46%"><svg viewBox="0 0 110 100" aria-hidden="true"><path d="m28 53-8-8-7 5 5 5 8 3m19-13c-12-4-25 2-23 14l7 8-5 23h8l8-21 15 1 7 20h8l-4-24 13-12 4-22 10-5-4-8-9 2-5 13-18 13Z" fill="#553e2d"/><path d="m82 24-4-14-7-5m8 11-10-1m16 9 5-16 8-5m-9 10 10 1" fill="none" stroke="#553e2d" stroke-width="3" stroke-linecap="round"/><circle cx="86" cy="26" r="1.5" fill="#fff3d7"/></svg></button><span class="hunt-feedback" id="hunt-feedback">Find your mark.</span></div><div class="hunt-footer"><span>Up to 5 hits. Bring back what you can.</span><button class="button secondary" data-action="finish-hunt">Return to camp ${icon("arrow")}</button></div>`,
    "hunting-dialog",
  );
  hunting = { hits: 0, seconds: 20, shots: 8, timer: null };
  hunting.timer = setInterval(() => {
    if (!hunting) return;
    hunting.seconds--;
    const label = document.querySelector("#hunt-time");
    if (label) label.textContent = `${hunting.seconds}s`;
    moveDeer();
    if (hunting.seconds <= 0) finishHunt();
  }, 1000);
}

function moveDeer(): void {
  const deer = document.querySelector<HTMLButtonElement>("#deer-target");
  if (deer) {
    deer.style.left = `${8 + Math.random() * 72}%`;
    deer.style.top = `${24 + Math.random() * 38}%`;
  }
}

function shoot(hit: boolean): void {
  if (!hunting) return;
  hunting.shots--;
  if (hit) hunting.hits++;
  document.querySelector("#hunt-hits")!.textContent = `${hunting.hits} / 5`;
  document.querySelector("#hunt-shots")!.textContent = String(hunting.shots);
  document.querySelector("#hunt-feedback")!.textContent = hit
    ? "A clean shot. Well done."
    : "Missed. Take a breath.";
  moveDeer();
  if (hunting.hits >= 5 || hunting.shots <= 0) finishHunt();
}

function finishHunt(): void {
  if (!hunting) return;
  const hits = hunting.hits;
  if (hunting.timer) clearInterval(hunting.timer);
  hunting = null;
  update(hunt(state, hits));
  showDialog(
    "Back by the campfire.",
    `<div class="hunt-result">${icon(hits > 0 ? "leaf" : "camp")}<h3>${hits > 0 ? "Something for the supper pot." : "Some days, the wild wins."}</h3><p>${hits} successful ${hits === 1 ? "shot" : "shots"}. ${escape(state.log[state.log.length - 1]?.body ?? "")}</p></div><button class="button full-width" data-action="close">Return to the journey ${icon("arrow")}</button>`,
  );
}

function downloadJournal(): void {
  const text =
    `WESTWARD — ${state.partyName}\n${number(state.miles)} miles in ${state.day} days\n\n` +
    state.log
      .map(
        (entry) =>
          `${date(false, entry.day)} — Day ${entry.day}\n${entry.title}\n${entry.body}`,
      )
      .join("\n\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "westward-trail-journal.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

app.addEventListener("click", (event) => {
  const target = event.target as Element;
  const button = target.closest<HTMLElement>("button, a[data-view]");
  if (button?.hasAttribute("disabled")) return;
  if (button?.dataset.view) {
    event.preventDefault();
    view = button.dataset.view as View;
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }
  if (target.closest("#hunting-field")) {
    shoot(!!target.closest("#deer-target"));
    return;
  }
  if (button?.dataset.buy) {
    update(trade(state, button.dataset.buy as Parameters<typeof trade>[1]));
    shopDialog();
    return;
  }
  if (button?.dataset.cross) {
    update(
      crossRiver(
        state,
        button.dataset.cross as Parameters<typeof crossRiver>[1],
      ),
    );
    return;
  }
  switch (button?.dataset.action) {
    case "travel":
      update(travel(state));
      break;
    case "rest":
      update(rest(state));
      break;
    case "heal":
      update(heal(state));
      break;
    case "repair":
      update(repair(state));
      break;
    case "hunt":
      startHunt();
      break;
    case "finish-hunt":
      finishHunt();
      break;
    case "trade":
      shopDialog();
      break;
    case "supplies":
      suppliesDialog();
      break;
    case "cross":
      riverDialog();
      break;
    case "new":
      newExpedition();
      break;
    case "download":
      downloadJournal();
      break;
    case "close":
      if (hunting) finishHunt();
      else document.querySelector<HTMLDialogElement>("#game-dialog")!.close();
      break;
  }
});

app.addEventListener("change", (event) => {
  const input = event.target as HTMLSelectElement;
  if (input.id === "pace") {
    update(setPace(state, input.value as Pace));
    document.querySelector<HTMLSelectElement>("#pace")?.focus();
  }
  if (input.id === "rations") {
    update(setRations(state, input.value as Rations));
    document.querySelector<HTMLSelectElement>("#rations")?.focus();
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (form.id !== "new-expedition-form") return;
  const data = new FormData(form);
  const names = String(data.get("names"))
    .split(",")
    .map((name) => name.trim());
  const partyName = String(data.get("partyName")).trim();
  if (
    names.length !== 5 ||
    names.some((name) => name.length < 1 || name.length > 24) ||
    !partyName
  ) {
    document.querySelector("#form-error")!.textContent =
      "Enter a party name and exactly five traveler names, each 1–24 characters, separated by commas.";
    return;
  }
  view = "journey";
  update(
    createGame({
      partyName,
      names,
      profession: data.get("profession") as Profession,
    }),
  );
});

window.addEventListener("pagehide", () => {
  if (hunting) finishHunt();
});
saveGame();
render();
