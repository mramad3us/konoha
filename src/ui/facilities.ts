/**
 * Facility panels: Mission Desk, shop, hospital, ramen stand, home, training shed, academy.
 */

import type { PlayFlow } from '../screens/play.ts';
import { Sheet } from './sheet.ts';
import { h, button, seal, spriteCanvas } from './kit.ts';
import { missions, refreshBoard, accept, report, abandon, canTake, promotionStatus, active, isAway, type Mission } from '../sim/missions.ts';
import { place } from '../content/world.ts';
import { roster, assignSquad } from '../sim/squad.ts';
import { buy, sell, sellPrice, hospital, ramen, sleep, trainSession, TRAINING, type TrainingKind } from '../sim/facilities.ts';
import { ITEMS, ITEM_ORDER } from '../content/items.ts';
import { atlas } from '../render/atlas.ts';
import { HOSPITAL_PRICE } from '../core/config.ts';
import { prepareVillageMission } from '../sim/campaign.ts';
import { VILLAGERS } from '../content/villagers.ts';
import { sfx } from '../audio/audio.ts';

function ryo(n: number): string {
  return `${n.toLocaleString('en')} ryo`;
}

function note(sheet: Sheet, text: string, good = true): void {
  let n = sheet.body.querySelector<HTMLDivElement>('.sheet__note');
  if (!n) { n = h('div', 'sheet__note'); sheet.body.prepend(n); }
  n.textContent = text;
  n.classList.toggle('sheet__note--bad', !good);
  if (!good) sfx.ui('error');
}

// ── Mission Desk ──

export async function openDesk(flow: PlayFlow): Promise<void> {
  const g = flow.game;
  refreshBoard(g);
  const sheet = new Sheet(flow.root, 'Mission Desk', 'wood', 'Hokage Tower');
  let sel = 0;
  const render = () => {
    sheet.body.innerHTML = '';
    sheet.clearKeys();
    const s = missions(g);
    const rec = g.player.record.missions;
    sheet.body.append(h('div', 'desk__status',
      h('span', 'desk__rank', `${g.player.sheet.rank[0].toUpperCase()}${g.player.sheet.rank.slice(1)}`),
      h('span', 'desk__rec', `Completed: D ${rec.D}, C ${rec.C}, B ${rec.B}, A ${rec.A}`),
      h('span', 'desk__ryo', ryo(g.player.inventory.ryo)),
    ));

    const a = s.active;
    if (a) {
      const st = a.status === 'complete' ? 'Ready to report' : a.status === 'failed' ? 'Failed' : isAway(a.m) ? `In progress — head out through the main gate to ${place(a.m.place!).name}` : 'In progress';
      const strip = h('div', `desk__active desk__active--${a.status}`,
        seal(a.m.rank, { size: 15 }),
        h('div', 'desk__activeText', h('div', 'desk__activeTitle', a.m.title), h('div', 'desk__activeState', st)),
      );
      if (a.status !== 'active') {
        strip.append(button('Report', () => {
          const msg = report(g);
          if (msg) g.say(msg, a.status === 'complete' ? 'good' : 'bad');
          flow.view.flush();
          render();
          if (msg) note(sheet, msg, a.status === 'complete');
          void flow.autosave();
        }, 'btn btn--seal', 'R'));
        sheet.bind('KeyR', () => (strip.querySelector('.btn--seal') as HTMLButtonElement).click());
      } else {
        strip.append(button('Abandon', () => { abandon(g); flow.view.flush(); render(); }, 'btn btn--ghost'));
      }
      sheet.body.append(strip);
    }

    // Promotion notice
    const promo = promotionStatus(g);
    if (promo.next) {
      const cool = Number(g.player.flags.trialCooldownDay ?? 0) > g.day;
      const box = h('div', 'desk__promo',
        h('div', 'desk__promoTitle', `Promotion to ${promo.next === 'chunin' ? 'Chunin' : 'Jonin'}`),
        h('div', 'desk__promoText', promo.ready ? (cool ? 'The proctors want you to rest first. Come back in a couple of days.' : 'You meet the requirements. A proctor will test you in the arena.') : `Still needed: ${promo.needs.join('; ')}.`),
      );
      if (promo.ready && !cool && !a) {
        box.append(button('Request the trial', () => { sheet.close(); void flow.startTrial(promo.next!); }, 'btn', 'T'));
        sheet.bind('KeyT', () => { sheet.close(); void flow.startTrial(promo.next!); });
      }
      sheet.body.append(box);
    }

    // Board of slips + detail scroll
    const wrap = h('div', 'desk__wrap');
    const board = h('div', 'board');
    const list = s.board;
    if (sel >= list.length) sel = Math.max(0, list.length - 1);
    list.forEach((m, i) => {
      const ok = canTake(g, m.rank).ok;
      const slip = h('button', `slip${i === sel ? ' slip--sel' : ''}${ok ? '' : ' slip--locked'}`,
        h('span', 'slip__pin'),
        seal(m.rank, { size: 15, tilt: ((i * 37) % 7) - 3 }),
        h('div', 'slip__title', m.title),
        h('div', 'slip__where', m.place ? place(m.place).name : 'Inside the village'),
        h('div', 'slip__pay', ryo(m.reward)),
      );
      slip.style.setProperty('--tilt', `${((i * 53) % 5) - 2}deg`);
      slip.addEventListener('click', () => { sel = i; sfx.ui('move'); render(); });
      board.append(slip);
    });
    if (!list.length) board.append(h('div', 'board__empty', 'The board is bare. New requests are posted every morning.'));
    wrap.append(board);
    const m = list[sel];
    if (m) wrap.append(detail(flow, sheet, m, () => render()));
    sheet.body.append(wrap);
    sheet.bind('ArrowRight', () => { sel = Math.min(list.length - 1, sel + 1); sfx.ui('move'); render(); });
    sheet.bind('ArrowLeft', () => { sel = Math.max(0, sel - 1); sfx.ui('move'); render(); });
    sheet.bind('ArrowDown', () => { sel = Math.min(list.length - 1, sel + 3); sfx.ui('move'); render(); });
    sheet.bind('ArrowUp', () => { sel = Math.max(0, sel - 3); sfx.ui('move'); render(); });
  };
  render();
  await sheet.wait();
}

function detail(flow: PlayFlow, sheet: Sheet, m: Mission, rerender: () => void): HTMLElement {
  const g = flow.game;
  const take = canTake(g, m.rank);
  const scroll = h('div', 'scroll',
    h('div', 'scroll__rank', seal(`${m.rank}-RANK`, { tilt: -4 })),
    h('h3', 'scroll__title', m.title),
    h('div', 'scroll__client', `Client: ${m.client}`),
    h('p', 'scroll__brief', m.brief),
    h('div', 'scroll__facts',
      h('div', null, h('span', 'k', 'Where'), h('span', 'v', m.place ? `${place(m.place).name}, ${place(m.place).km} km` : 'Konohagakure')),
      h('div', null, h('span', 'k', 'Pay'), h('span', 'v', ryo(m.reward))),
      h('div', null, h('span', 'k', 'Posted until'), h('span', 'v', `Day ${m.expires}`)),
    ),
  );
  if (isAway(m)) {
    const sq = assignSquad(g, 2).map(id => roster(g).find(r => r.id === id)!.name);
    scroll.append(h('div', 'scroll__squad', sq.length ? `Your squad: ${sq.join(' and ')}.` : 'No squadmates are fit to join you. You go alone.'));
  }
  if (!take.ok) scroll.append(h('div', 'scroll__locked', take.why ?? 'Not available.'));
  else if (active(g)) scroll.append(h('div', 'scroll__locked', 'Finish your current mission first.'));
  else {
    const go = () => {
      const r = accept(g, m.id);
      if (!r.ok) { note(sheet, r.why ?? 'Cannot accept.', false); return; }
      prepareVillageMission(g);
      flow.view.flush();
      rerender();
      note(sheet, isAway(m) ? 'Accepted. Gear up, then leave through the main gate.' : 'Accepted. Your objective is in the top-right corner.');
    };
    scroll.append(button('Accept', go, 'btn btn--seal', 'Enter'));
    sheet.bind('Enter', go);
    sheet.bind('KeyF', go);
  }
  return scroll;
}

// ── Shop ──

export async function openShop(flow: PlayFlow): Promise<void> {
  const g = flow.game;
  const sheet = new Sheet(flow.root, 'Kurogane Arms', 'counter', 'Tetsuo, weaponsmith');
  const render = () => {
    sheet.body.innerHTML = '';
    sheet.body.append(h('div', 'shop__purse', h('span', null, 'Your purse'), h('span', 'shop__ryo', ryo(g.player.inventory.ryo))));
    const rows = h('div', 'shop');
    for (const k of ITEM_ORDER) {
      const d = ITEMS[k];
      const f = atlas.prop(`item_${k}`, 0, 0, 0);
      const have = g.player.inventory.items[k] ?? 0;
      const row = h('div', 'shop__row',
        h('div', 'shop__icon', spriteCanvas(f.cv, 0, 0, f.w, f.h, 4)),
        h('div', 'shop__text', h('div', 'shop__name', `${d.name[0].toUpperCase()}${d.name.slice(1)}`), h('div', 'shop__desc', d.description)),
        h('div', 'shop__have', `You have ${have}`),
        h('div', 'shop__price', ryo(d.price)),
      );
      const act = h('div', 'shop__act');
      act.append(button('Buy', () => { const o = buy(g, k, 1); render(); note(sheet, o.text, o.ok); }, 'btn btn--small'));
      if (k === 'kunai' || k === 'shuriken') act.append(button('Buy 5', () => { const o = buy(g, k, 5); render(); note(sheet, o.text, o.ok); }, 'btn btn--small'));
      if (have > 0) act.append(button(`Sell (${sellPrice(k)})`, () => { const o = sell(g, k, 1); render(); note(sheet, o.text, o.ok); }, 'btn btn--small btn--ghost'));
      row.append(act);
      rows.append(row);
    }
    sheet.body.append(rows);
    flow.view.hud.refresh();
  };
  render();
  await sheet.wait();
}

// ── Simple service panels ──

async function service(flow: PlayFlow, title: string, surface: 'washi' | 'counter', who: string, line: string, actions: Array<{ label: string; key: string; run: () => { ok: boolean; text: string } | void; close?: boolean }>): Promise<void> {
  const sheet = new Sheet(flow.root, title, surface, who);
  sheet.body.append(h('p', 'svc__line', line));
  const row = h('div', 'svc__actions');
  actions.forEach((a, i) => {
    const run = () => {
      const r = a.run();
      flow.view.flush();
      if (r) note(sheet, r.text, r.ok);
      if (a.close) sheet.close();
    };
    row.append(button(a.label, run, 'btn', String(i + 1)));
    sheet.bind(`Digit${i + 1}`, run);
  });
  sheet.body.append(row);
  await sheet.wait();
}

export function openHospital(flow: PlayFlow): Promise<void> {
  const v = flow.game.player.vitals;
  return service(flow, 'Konoha Hospital', 'washi', 'Dr. Rei Shimizu',
    v.hp < v.hpMax ? '"Sit. Let me see those cuts." She is already reaching for the antiseptic.' : '"You look fine to me. Don\'t waste my beds."',
    [{ label: `Get treated (${HOSPITAL_PRICE} ryo)`, key: '1', close: true, run: () => { void flow.wipe(() => { const o = hospital(flow.game); flow.game.say(o.text, o.ok ? 'good' : 'info'); }); } }]);
}

export function openRamen(flow: PlayFlow): Promise<void> {
  return service(flow, 'Ichigo Ramen', 'counter', 'Old Tokuji',
    '"Miso, shoyu or shio? Doesn\'t matter, you\'ll have miso."',
    [{ label: 'Eat a bowl (12 ryo)', key: '1', run: () => ramen(flow.game) }]);
}

export function openHome(flow: PlayFlow): Promise<void> {
  return service(flow, 'Home', 'washi', 'Your apartment',
    'A futon, a shelf of scrolls you mean to read, and a window onto the Hokage monument.',
    [
      { label: 'Sleep until morning', key: '1', run: () => { flow.wipe(() => { const o = sleep(flow.game); flow.game.say(o.text, 'system'); void flow.autosave(); }); }, close: true },
      { label: 'Save your progress', key: '2', run: () => { void flow.save(); return { ok: true, text: 'Progress saved.' }; } },
    ]);
}

export async function openTraining(flow: PlayFlow): Promise<void> {
  const g = flow.game;
  const sheet = new Sheet(flow.root, 'Training Shed', 'washi', 'Drills, targets and a quiet pond');
  let hours = 2;
  const render = () => {
    sheet.body.innerHTML = '';
    sheet.clearKeys();
    const t = g.player.training;
    const used = t.day === g.day ? t.hours : 0;
    sheet.body.append(h('p', 'svc__line', `Training pays off most in the first six hours of a day. Today you have trained ${used} hour${used === 1 ? '' : 's'}.`));
    const hrs = h('div', 'train__hours', h('span', null, 'Session length'));
    for (const n of [1, 2, 4]) {
      const b = button(`${n}h`, () => { hours = n; render(); }, `btn btn--small${n === hours ? ' btn--on' : ''}`);
      hrs.append(b);
    }
    sheet.body.append(hrs);
    const list = h('div', 'train');
    (Object.keys(TRAINING) as TrainingKind[]).forEach((k, i) => {
      const d = TRAINING[k];
      const run = () => {
        void flow.wipe(() => {
          const o = trainSession(g, k, hours);
          g.say(o.text, 'skill');
          flow.view.flush();
          render();
          note(sheet, o.text, true);
        });
      };
      list.append(h('button', 'train__row',
        h('span', 'cap', String(i + 1)),
        h('span', 'train__label', d.label),
        h('span', 'train__desc', d.desc),
      ));
      (list.lastChild as HTMLButtonElement).addEventListener('click', run);
      sheet.bind(`Digit${i + 1}`, run);
    });
    sheet.body.append(list);
    const partners = VILLAGERS.filter(v => v.arch === 'sparring').map(v => v.name);
    const spar = h('div', 'train__spar', h('span', null, 'Or spar in the arena with a friend:'));
    for (const name of partners) spar.append(button(name, () => { sheet.close(); void flow.startSpar(name); }, 'btn btn--small'));
    sheet.body.append(spar);
  };
  render();
  await sheet.wait();
}

export async function openAcademy(flow: PlayFlow): Promise<void> {
  const tips = VILLAGERS.find(v => v.name === 'Haruki')!.lines;
  const sheet = new Sheet(flow.root, 'Ninja Academy', 'washi', 'Haruki-sensei');
  let i = 0;
  const p = h('p', 'svc__line', tips[0]);
  const next = () => { i = (i + 1) % tips.length; p.textContent = tips[i]; sfx.ui('move'); };
  sheet.body.append(p, h('div', 'svc__actions', button('Another lesson', next, 'btn', 'Enter')));
  sheet.bind('Enter', next);
  sheet.bind('KeyF', next);
  await sheet.wait();
}
