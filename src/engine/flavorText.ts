/**
 * Scalable flavor text generation for combat and other systems.
 *
 * Each outcome type has large pools of templates with body-part specifics,
 * technique descriptions, and matchup-aware epicness scaling.
 *
 * Skill tiers:  low (0-30), mid (31-65), high (66-100)
 * Matchups change the tone: masters are effortless, novices are clumsy,
 * master vs master is legendary.
 */

import type { CombatOutcome, CombatOutcomeType } from '../types/combat.ts';

type SkillTier = 'low' | 'mid' | 'high';
type MatchupType = `${SkillTier}_v_${SkillTier}`;

function getSkillTier(skill: number): SkillTier {
  if (skill < 31) return 'low';
  if (skill < 66) return 'mid';
  return 'high';
}

function getMatchup(a: number, b: number): MatchupType {
  return `${getSkillTier(a)}_v_${getSkillTier(b)}`;
}

interface FlavorPool {
  default: string[];
  matchups?: Partial<Record<MatchupType, string[]>>;
}

// ── FLAVOR POOLS ──

const FLAVOR_POOLS: Record<CombatOutcomeType, FlavorPool> = {

  // ═════════════════════════════════
  //  PERFECT PARRY (defender wins tempo)
  // ═════════════════════════════════
  perfect_parry: {
    default: [
      '{defender} catches the incoming fist and twists it aside, stepping into {attacker}\'s space.',
      '{attacker} throws a right hook — {defender} slaps it down with an open palm and shoves {attacker} back.',
      'A sharp knee comes in — {defender} drops their hip and redirects it cleanly with a forearm block.',
      '{defender} reads the telegraphed jab, ducks under it, and comes up inside {attacker}\'s guard.',
      '{attacker} lunges with an elbow — {defender} catches the arm at the wrist and rolls it harmlessly away.',
      '{defender} intercepts the kick mid-arc, turning {attacker}\'s momentum against them.',
      'A textbook parry — {defender} deflects the strike with the back of their hand, barely moving.',
      '{attacker} commits to a straight punch; {defender} pivots, letting it sail past their ear.',
      '{defender} catches the incoming roundhouse on a raised shin, absorbing zero impact.',
      '{attacker}\'s overhead chop meets {defender}\'s crossed wrists — redirected into the dirt.',
      '{defender} turns sideways, letting the haymaker brush past their chest. Not even close.',
      'The spinning backfist finds nothing — {defender} was already leaning out of range.',
      '{defender} traps {attacker}\'s striking arm against their body and pushes off.',
      '{attacker} fires a front kick — {defender} scoops it aside with a sweep of the forearm.',
      'An uppercut comes up fast — {defender} tilts their chin back just enough, feeling the breeze.',
    ],
    matchups: {
      high_v_low: [
        '{defender} doesn\'t even shift stance — a lazy hand brushes the amateur swing aside.',
        '{attacker} telegraphs the punch from a mile away. {defender} yawns internally.',
        'Without looking, {defender} catches {attacker}\'s wrist. The gap in skill is embarrassing.',
        '{defender} flicks the incoming fist away like swatting a fly. Child\'s play.',
        '{attacker} charges in — {defender} sidesteps with their hands behind their back.',
        'The clumsy haymaker passes so far from {defender}\'s face they barely acknowledge it.',
      ],
      high_v_high: [
        'A feint within a feint — {defender} reads through both layers and parries the real strike.',
        'Their forearms crack together like thunder. {defender} redirects the force with surgical precision.',
        '{attacker}\'s three-hit combination is dismantled in sequence — {defender} predicted every angle.',
        'Two masters exchange in a blur — {defender} emerges with the timing advantage. Barely.',
        '{defender}\'s counter-timing is inhuman. The parry happens before {attacker} fully commits.',
        'A clash that would shatter lesser fighters — {defender} absorbs it and turns the energy back.',
      ],
      low_v_low: [
        '{defender} steps back into a textbook academy guard — the strike is swept aside cleanly.',
        '{defender} catches the technique on a raised forearm. A solid block for a young shinobi.',
        'Fresh from the academy, {defender}\'s reflexes kick in — the parry is clean if not graceful.',
        '{defender} reads the basic combination and blocks at the wrist. Training pays off.',
        'A sharp inward block — {defender} may be green, but they paid attention in class.',
      ],
      mid_v_mid: [
        '{defender} executes a clean inward block, sweeping the punch across {attacker}\'s body.',
        'Good timing — {defender} raises a guard at the exact right moment, deflecting the shin kick.',
        '{defender} steps offline and parries with a solid knife-hand. Textbook stuff.',
        'The hook is coming — {defender} sees it, drops under, and lets it pass overhead.',
      ],
      low_v_high: [
        '{defender} barely gets a guard up in time — the impact rattles their bones but the block holds.',
        'A desperate cross-arm block stops the devastating strike. {defender}\'s arms are numb.',
        '{defender} throws up both hands and somehow catches the blow. Survival instinct at work.',
      ],
      mid_v_high: [
        '{defender} reads the advanced technique and manages a solid parry — surprising even themselves.',
        'A well-timed block absorbs the powerful strike. {defender} grits their teeth but holds.',
      ],
    },
  },

  // ═════════════════════════════════
  //  IMPERFECT BLOCK (half damage)
  // ═════════════════════════════════
  imperfect_block: {
    default: [
      '{attacker}\'s fist slides past the guard and clips {defender}\'s jaw. ({damage} dmg)',
      'The block catches most of it, but {attacker}\'s knuckles rake across {defender}\'s ribs. ({damage} dmg)',
      '{defender} raises a guard too late — the kick grazes their thigh, dead-legging them. ({damage} dmg)',
      'A partial deflection — {attacker}\'s elbow skids off {defender}\'s forearm and tags the temple. ({damage} dmg)',
      '{defender} blocks the body shot but {attacker}\'s followthrough catches the hip. ({damage} dmg)',
      'The shin kick is half-caught — enough force gets through to buckle {defender}\'s stance. ({damage} dmg)',
      '{attacker}\'s straight right glances off the raised guard and scrapes {defender}\'s ear. ({damage} dmg)',
      'Blocked high, but the knee underneath connects with {defender}\'s midsection. ({damage} dmg)',
      '{defender}\'s arms absorb the brunt but the impact drives them back a step. ({damage} dmg)',
      '{attacker} feints high and the real strike — a body hook — sneaks through low. ({damage} dmg)',
      'The cross-guard catches the fist, but the shockwave ripples through {defender}\'s shoulders. ({damage} dmg)',
      '{attacker}\'s backhand cracks against {defender}\'s hastily raised forearm, numbing the arm. ({damage} dmg)',
    ],
    matchups: {
      high_v_low: [
        '{attacker} threads the needle — the punch flows around {defender}\'s sloppy guard like water. ({damage} dmg)',
        '{defender}\'s guard might as well not exist — {attacker} finds the gap without trying. ({damage} dmg)',
        'A surgical strike slips through the wide-open defense and cracks against {defender}\'s cheekbone. ({damage} dmg)',
      ],
      high_v_high: [
        'A near-perfect defense, but {attacker} finds the millimeter gap and exploits it. ({damage} dmg)',
        '{defender}\'s guard is textbook — but {attacker} wrote a different textbook. ({damage} dmg)',
        'The block is beautiful. The strike that bends around it is more beautiful. ({damage} dmg)',
      ],
      low_v_low: [
        '{attacker}\'s speed catches {defender}\'s guard a beat too late — the knuckles rake the jaw. ({damage} dmg)',
        '{defender}\'s academy stance holds, but {attacker} finds the gap between forearm and shoulder. ({damage} dmg)',
      ],
    },
  },

  // ═════════════════════════════════
  //  CLEAN HIT (full damage, no block)
  // ═════════════════════════════════
  clean_hit: {
    default: [
      '{attacker} drives a straight right into {defender}\'s sternum. The air leaves their lungs. ({damage} dmg)',
      'A vicious roundhouse connects flush with {defender}\'s ribs — something cracks. ({damage} dmg)',
      '{attacker} buries a knee into {defender}\'s gut, doubling them over. ({damage} dmg)',
      'The uppercut catches {defender} square under the chin, snapping their head back. ({damage} dmg)',
      '{attacker}\'s elbow comes around like a wrecking ball and catches {defender} in the temple. ({damage} dmg)',
      'A spinning heel kick crashes into {defender}\'s shoulder, sending them stumbling. ({damage} dmg)',
      '{attacker} fires a palm strike into {defender}\'s chest — they skid back two feet. ({damage} dmg)',
      'The overhand right drops like a hammer onto {defender}\'s collarbone. ({damage} dmg)',
      '{attacker} drives a front kick square into {defender}\'s hip, buckling the leg. ({damage} dmg)',
      '{attacker} closes the distance and drives a headbutt into {defender}\'s nose. ({damage} dmg)',
      'A sharp jab snaps {defender}\'s head sideways — they see stars. ({damage} dmg)',
      'The axe kick descends on {defender}\'s shoulder like a falling tree. ({damage} dmg)',
      '{attacker} catches {defender} with a savage hook to the liver. {defender} crumbles. ({damage} dmg)',
      'A lunging double-palm strike connects with {defender}\'s chest, launching them backwards. ({damage} dmg)',
      '{attacker} threads a straight punch through the gap and finds {defender}\'s throat. ({damage} dmg)',
    ],
    matchups: {
      high_v_low: [
        '{attacker} barely moves — a flicker of the hand, and {defender}\'s nose is bleeding. ({damage} dmg)',
        'One step, one strike. {defender} doesn\'t even see the backfist until the ground rushes up. ({damage} dmg)',
        '{attacker} taps two pressure points in succession. {defender}\'s arm goes dead. ({damage} dmg)',
        'A casual-looking palm strike sends {defender} tumbling end over end. ({damage} dmg)',
        '{attacker} strikes once. {defender} falls. That\'s the whole story. ({damage} dmg)',
        'The open-hand slap is almost disrespectful — but {defender} drops like a puppet with cut strings. ({damage} dmg)',
      ],
      high_v_high: [
        'In a fraction of a heartbeat, {attacker} finds the impossible opening — a spear-hand strike pierces through and finds the solar plexus. ({damage} dmg)',
        'A combination of strikes so fast they blur — the final one, a devastating knee, breaks through. ({damage} dmg)',
        '{attacker} reads the counter-pattern, creates a false opening, then punishes the correction. Genius. ({damage} dmg)',
        'Two legends clash — {attacker}\'s timing is one thousandth of a second sharper. It\'s enough. ({damage} dmg)',
        'The strike that lands is the seventh in a sequence of feints. Only a master could have orchestrated it. ({damage} dmg)',
      ],
      low_v_low: [
        '{attacker} closes fast with a rushing palm strike — {defender} doesn\'t react in time. ({damage} dmg)',
        'A quick academy-style combination — the second hit breaks through {defender}\'s guard. ({damage} dmg)',
        '{attacker} channels chakra to their fist and drives it into {defender}\'s ribs. Still learning, but it lands. ({damage} dmg)',
        '{attacker} drops low and sweeps a kick into {defender}\'s thigh before they can check it. ({damage} dmg)',
      ],
      mid_v_mid: [
        '{attacker} slips past the guard with a well-drilled hook that catches the jaw. ({damage} dmg)',
        'A solid combination — jab, cross, hook — the hook connects clean. ({damage} dmg)',
        '{attacker} times the counter perfectly, driving a kick into {defender}\'s exposed flank. ({damage} dmg)',
      ],
    },
  },

  // ═════════════════════════════════
  //  CLASH: STALEMATE (same attack, no tempo)
  // ═════════════════════════════════
  clash_stalemate: {
    default: [
      'Their fists collide mid-strike — knuckles crack against knuckles. Neither budges.',
      'Both throw kicks at the same instant. Shins meet with a crack. They push off.',
      '{attacker} and {defender} punch simultaneously — forearms smash together and both stagger back.',
      'Two strikes launch at once and tangle in the middle. A mess of limbs, no winner.',
      'Their elbows crack together mid-arc. The impact vibrates up both arms.',
      'Identical timing — both close for a knee strike and jam each other up. Reset.',
      'They throw the same punch at the same time. Fists deflect off each other harmlessly.',
      'A mirror exchange — both fighters launch the same technique and cancel each other out.',
      'Simultaneous palm strikes — they push off each other and slide back to starting distance.',
    ],
    matchups: {
      high_v_high: [
        'Two masters strike in perfect synchrony — the shockwave of the collision whips up a dust cloud.',
        'Their fists meet at the exact same point in space. The impact sends a tremor through the ground.',
        'A clash that could shatter stone — neither yields a single inch.',
        'The sound of the collision echoes off the trees. Leaves fall. Neither master blinks.',
        'They read each other so perfectly they throw identical strikes. Time freezes for an instant.',
      ],
      low_v_low: [
        'Both young shinobi strike at the same instant — their forearms crack together mid-technique.',
        'Matching speed, matching power — the collision sends a jolt through both fighters. A clean stalemate.',
        'They launch identical academy-drilled strikes and jam each other up. Equal in every way.',
      ],
    },
  },

  // ═════════════════════════════════
  //  CLASH: TEMPO WIN (momentum advantage)
  // ═════════════════════════════════
  clash_tempo_win: {
    default: [
      '{attacker} was already half a step ahead — the accumulated rhythm pays off with a crushing cross to the jaw. ({damage} dmg)',
      'Riding momentum, {attacker} parries the incoming strike AND drives a knee into {defender}\'s ribs in one motion. ({damage} dmg)',
      '{attacker}\'s setup from earlier creates the opening now — a palm strike shoots through {defender}\'s guard. ({damage} dmg)',
      'Superior positioning — {attacker} blocks {defender}\'s punch with one hand and drives an elbow with the other. ({damage} dmg)',
      '{attacker} uses the accumulated advantage to time a devastating counter-kick through {defender}\'s own attack. ({damage} dmg)',
      'The tempo shifts — {attacker} catches the strike, redirects it, and follows with a spinning backfist to the temple. ({damage} dmg)',
      '{attacker} was ready. A simultaneous parry-and-punch combination catches {defender} completely flat-footed. ({damage} dmg)',
      'Built-up rhythm explodes — {attacker} slips the punch and hammers a body shot home. ({damage} dmg)',
    ],
    matchups: {
      high_v_high: [
        '{attacker} converts three rounds of patient setup into one devastating combination. The final knee buckles {defender}\'s stance. ({damage} dmg)',
        'A master\'s patience rewarded — {attacker} reads the rhythm, breaks it, and strikes in the silence between heartbeats. ({damage} dmg)',
        'The accumulated advantage crystallizes into a single perfect strike — {defender} never had a chance to counter. ({damage} dmg)',
      ],
    },
  },

  // ═════════════════════════════════
  //  CLASH: RNG (different attacks, skill decides)
  // ═════════════════════════════════
  clash_rng: {
    default: [
      'Both commit — {attacker}\'s hook arrives a split-second before {defender}\'s, cracking against the jaw. ({damage} dmg)',
      'A chaotic exchange of strikes — {attacker}\'s kick finds its mark while {defender}\'s punch goes wide. ({damage} dmg)',
      '{attacker} ducks the incoming blow and drives an uppercut into {defender}\'s exposed chin. ({damage} dmg)',
      'Both throw heavy leather — {attacker}\'s right cross beats {defender}\'s left hook by a hair. ({damage} dmg)',
      '{attacker} weaves under the strike and counters with a devastating body shot. ({damage} dmg)',
      'In the chaos, {attacker}\'s elbow finds {defender}\'s orbital bone. {defender}\'s strike misses by inches. ({damage} dmg)',
      'They trade — {attacker} eats a graze to the shoulder but puts a clean shot on {defender}\'s ribs. ({damage} dmg)',
      '{attacker} slips left as both throw — their hook connects, {defender}\'s whiffs over the shoulder. ({damage} dmg)',
      'A savage exchange — {attacker} takes a scratch but delivers a crushing palm to {defender}\'s sternum. ({damage} dmg)',
      'Both swing for the fences — {attacker}\'s timing is fractionally better and the fist arrives first. ({damage} dmg)',
    ],
    matchups: {
      high_v_low: [
        '{defender}\'s wild swing is amateur hour. {attacker} leans back, lets it pass, and counters with surgical precision to the throat. ({damage} dmg)',
        '{attacker} doesn\'t even bother avoiding the clumsy attack — they tank it and deliver ten times worse. ({damage} dmg)',
        'The gap in skill is a canyon. {attacker} picks {defender}\'s attack apart mid-flight and punishes. ({damage} dmg)',
      ],
      high_v_high: [
        'In a breathtaking exchange that lasts barely a second, {attacker}\'s combination lands while {defender}\'s is neutralized. A razor-thin margin. ({damage} dmg)',
        'Both masters explode simultaneously — {attacker}\'s footwork is one degree sharper, and that\'s all it takes. ({damage} dmg)',
        'They trade at blinding speed — three strikes each, but {attacker}\'s last one finds the chin. ({damage} dmg)',
      ],
      low_v_low: [
        'Both young shinobi trade blows at speed — {attacker}\'s fist finds {defender}\'s ribs first. ({damage} dmg)',
        'A rapid exchange of academy techniques — {attacker}\'s timing edges out {defender}\'s by a hair. ({damage} dmg)',
        'They clash in a flurry of punches — {attacker}\'s training kicks in and the counter-strike connects. ({damage} dmg)',
      ],
    },
  },

  // ═════════════════════════════════
  //  TEMPO SAVE (dodge using stored momentum)
  // ═════════════════════════════════
  tempo_save: {
    default: [
      'The strike is coming — but {defender}\'s shadow clone takes the hit instead! The real {defender} is already three feet away.',
      '{defender} substitutes with a wooden log at the last possible instant. {attacker}\'s fist buries into bark.',
      'Accumulated awareness kicks in — {defender} reads the strike before it launches and body-flickers out of range.',
      '{defender}\'s earlier positioning pays off: they pivot on a pre-set foot and the blow whiffs past their ear.',
      'The hit should have landed. But {defender} was already in motion — a half-step dodge born from built-up rhythm.',
      'A puff of smoke — {defender} vanishes and the strike cuts empty air. Substitution jutsu.',
      '{defender} spends hard-earned advantage to create a split-second opening — they twist away as the fist grazes cloth.',
      'The momentum stored from earlier allows {defender} a burst of speed — they duck under the blow that should have ended them.',
      '{defender} burns tempo to execute a last-ditch ankle pivot, letting the devastating strike sail past by millimeters.',
    ],
    matchups: {
      high_v_high: [
        '{defender} executes a perfect body flicker — the accumulated advantage barely saves them from a strike that would have finished the fight.',
        'A master\'s sixth sense fires. {defender} was already moving to safety before {attacker}\'s muscles even contracted.',
        'Substitution at the highest level — {defender} replaces themselves so smoothly {attacker} doesn\'t realize they\'re hitting shadow until the impact.',
      ],
      low_v_low: [
        '{defender}\'s body-replacement technique is rough but functional — a training log takes the blow.',
        '{defender} kawarimis out at the last second. The execution is shaky, but the timing is pure instinct.',
      ],
      low_v_high: [
        '{defender} burns every bit of advantage they\'ve scraped together to barely avoid the devastating technique. They\'re shaking.',
        'Survival instinct overrides — {defender} spends their tempo to throw themselves bodily out of the path of destruction.',
      ],
    },
  },

  // ═════════════════════════════════
  //  CIRCLING (both defend)
  // ═════════════════════════════════
  circling: {
    default: [
      'They circle each other. {attacker} probes with a feint — {defender} doesn\'t bite.',
      'Feet shuffle on packed earth. Both fighters maintain distance, guards up, watching.',
      '{defender} tests the range with a lazy jab. {attacker} leans back. Neither commits.',
      'The space between them hums with tension. Every micro-movement is catalogued.',
      'They orbit each other like wary wolves, each waiting for the other to blink first.',
      '{attacker} shifts weight forward — {defender} mirrors it. Neither breaks the stalemate.',
      'Controlled breathing. Measured steps. The real fight is happening behind their eyes.',
      'A careful dance — both fighters respect the other\'s range and refuse to overextend.',
      'Dust rises from shuffling feet. Guards tight. Chins tucked. Waiting.',
    ],
    matchups: {
      high_v_high: [
        'Two masters read micro-movements invisible to lesser fighters. A battle of intention.',
        'The silence between them is deafening. Every blink is a potential opening. Neither offers one.',
        'To untrained eyes, nothing is happening. To anyone who knows combat, a war is being waged.',
        'They communicate in the language of stance and weight distribution. Neither finds an answer yet.',
      ],
      low_v_low: [
        'Two young shinobi circle, guards tight. Academy training keeps their stances sharp.',
        'Both maintain distance, testing each other\'s resolve. The first to flinch loses.',
        'They mirror each other\'s footwork — academy drills burned into muscle memory.',
      ],
      high_v_low: [
        '{defender} keeps their distance, studying {attacker} with a predator\'s patience.',
        '{attacker} doesn\'t dare close the distance. {defender} watches with mild interest.',
      ],
    },
  },

  // ═════════════════════════════════
  //  MISSED (whiff)
  // ═════════════════════════════════
  missed: {
    default: [
      '{attacker}\'s roundhouse sails over {defender}\'s head by a foot. Embarrassing.',
      'A lunging punch that hits nothing. {attacker} stumbles from their own momentum.',
      '{attacker} throws a knee strike at empty air — {defender} is nowhere near where they aimed.',
      'The haymaker whooshes past. {attacker} spins from the force of their own miss.',
      '{attacker}\'s kick connects with nothing but breeze and regret.',
    ],
    matchups: {
      high_v_high: [
        '{attacker}\'s strike was perfect in execution — but {defender} was simply not there.',
      ],
      low_v_low: [
        '{attacker}\'s strike is fast but overcommitted — {defender} slips it with a sharp lean.',
        'The technique is textbook, but {defender}\'s footwork takes them just out of range.',
      ],
    },
  },
};

// ── PUBLIC API ──

/**
 * Generate flavor text for a combat outcome.
 * Tries matchup-specific pool, then falls back to default.
 * Combines both pools for maximum variety when matchup pool is small.
 */
export function generateCombatFlavor(
  outcome: CombatOutcome,
  attackerName: string,
  defenderName: string,
  attackerSkill: number,
  defenderSkill: number,
): string {
  const pool = FLAVOR_POOLS[outcome.type];
  if (!pool) return `${attackerName} and ${defenderName} exchange blows.`;

  const matchup = getMatchup(attackerSkill, defenderSkill);
  const matchupPool = pool.matchups?.[matchup] ?? [];

  // Combine both pools for maximum variety, matchup-specific weighted 2:1
  const combined = [...matchupPool, ...matchupPool, ...pool.default];
  const template = combined[Math.floor(Math.random() * combined.length)];

  return template
    .replace(/\{attacker\}/g, attackerName)
    .replace(/\{defender\}/g, defenderName)
    .replace(/\{damage\}/g, String(outcome.damage));
}

/**
 * Generate a technical combat summary (parenthetical).
 */
export function generateCombatTechnical(outcome: CombatOutcome): string {
  const parts: string[] = [];
  if (outcome.damage > 0) parts.push(`${outcome.damage} dmg`);
  if (outcome.tempoChange.attacker !== 0) {
    parts.push(`atk tempo ${outcome.tempoChange.attacker > 0 ? '+' : ''}${outcome.tempoChange.attacker}`);
  }
  if (outcome.tempoChange.defender !== 0) {
    parts.push(`def tempo ${outcome.tempoChange.defender > 0 ? '+' : ''}${outcome.tempoChange.defender}`);
  }
  if (parts.length === 0) return '';
  return `(${parts.join(', ')})`;
}

// ── CRITICAL HIT FLAVOR ──

const CRIT_TEMPLATES = {
  default: [
    'CRITICAL! The blow sends a shockwave through {defender}\'s body!',
    'A devastating strike! {attacker} channels everything into one perfect impact!',
    'CRITICAL HIT! {defender} feels the world tilt as the blow connects!',
    'The strike lands with terrifying force! {attacker} finds the perfect angle!',
    'An explosive hit! The sheer power behind {attacker}\'s technique is staggering!',
    'CRITICAL! {attacker}\'s chakra-infused strike tears through with devastating force!',
    'A bone-rattling impact! {defender} sees white as the blow connects perfectly!',
    'The hit is surgical — {attacker} drives maximum force into minimum surface area!',
  ],
  high: [
    'CRITICAL! A master\'s precision — {attacker} strikes the tenketsu point with lethal accuracy!',
    'The strike resonates with killing intent. {defender} feels their body betray them!',
    '{attacker} finds the gap between heartbeats and delivers a blow that could end wars!',
    'A technique perfected over a thousand fights — {attacker}\'s strike is absolute!',
  ],
  low: [
    'CRITICAL! Even a young shinobi can find the right spot — and {attacker} just did!',
    'The academy taught the pressure points. {attacker} just landed one perfectly!',
    'A lucky angle, a perfect moment — {attacker}\'s strike carries devastating force!',
  ],
};

export function generateCritFlavor(attackerName: string, defenderName: string, attackerSkill: number, _defenderSkill: number): string {
  const tier = attackerSkill >= 66 ? 'high' : attackerSkill < 31 ? 'low' : 'default';
  const pool = [...CRIT_TEMPLATES[tier], ...CRIT_TEMPLATES.default];
  const template = pool[Math.floor(Math.random() * pool.length)];
  return template.replace(/\{attacker\}/g, attackerName).replace(/\{defender\}/g, defenderName);
}

// ── CONDITION APPLICATION FLAVOR ──

import type { CombatCondition } from '../types/combat.ts';

const CONDITION_TEMPLATES: Record<CombatCondition, string[]> = {
  down: [
    '{defender} crashes to the ground, barely catching themselves on one knee!',
    '{defender} is sent sprawling! They scramble to recover their footing!',
    'The impact drives {defender} to the dirt! They push themselves up, gasping!',
    '{defender} hits the ground hard — they roll and try to rise, but they\'re off-balance!',
    '{defender}\'s legs buckle under the force! They drop to a knee, vision swimming!',
    '{defender} staggers and falls, catching the earth with both hands. Vulnerable!',
    'Down! {defender} eats dirt as the blow sweeps their legs from under them!',
    '{defender} collapses to one knee, arms trembling from the impact!',
    'The force sends {defender} tumbling! They catch themselves, but barely!',
    '{defender} skids across the packed earth, scrambling to get back up!',
  ],
  stunned: [
    '{defender}\'s eyes go glassy — the blow rattles their brain! They can\'t move!',
    '{defender} freezes mid-motion, body locked up from the devastating impact!',
    'The strike hits a nerve cluster — {defender} stands paralyzed for a heartbeat!',
    '{defender}\'s vision doubles. Their arms drop. For one terrible second, they\'re helpless!',
    'STUNNED! {defender}\'s nervous system short-circuits from the precise impact!',
    '{defender} goes rigid, muscles seizing from the chakra-disrupting blow!',
    'The world spins around {defender} — they can\'t tell up from down, let alone fight!',
    '{defender}\'s body refuses commands. The blow scrambled something important!',
    '{defender} stands stock-still, eyes unfocused, completely open to attack!',
    'A ringing silence fills {defender}\'s skull. The world freezes. They can\'t respond!',
  ],
};

export function generateConditionFlavor(defenderName: string, condition: CombatCondition): string {
  const pool = CONDITION_TEMPLATES[condition];
  const template = pool[Math.floor(Math.random() * pool.length)];
  return template.replace(/\{defender\}/g, defenderName);
}
