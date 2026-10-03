/**
 * The people of Konohagakure. Original characters only. Each has a work spot (key into the
 * village's named spots), working hours and things to say — several quietly teach mechanics.
 */

export interface VillagerDef {
  name: string;
  title: string;
  arch: 'villager' | 'leaf_guard' | 'sparring' | 'anbu';
  frame: 'm' | 'f';
  work: string;        // named spot key
  hours: [number, number];
  lines: string[];
  /** Stands still at work (shopkeepers, guards) instead of wandering. */
  post?: boolean;
  /** Can be the recipient of delivery missions. */
  recipient?: boolean;
}

export const VILLAGERS: VillagerDef[] = [
  {
    name: 'Kanta', title: 'Gate Guard', arch: 'leaf_guard', frame: 'm', work: 'gate', hours: [0, 24], post: true,
    lines: ['Mission paperwork first, then the gate. Rules are rules.', 'Bandits on the Kusagaya road again. Keep your eyes open out there.', 'Night duty is quiet. Too quiet, some nights.'],
  },
  {
    name: 'Sota', title: 'Gate Guard', arch: 'leaf_guard', frame: 'm', work: 'gate', hours: [0, 24], post: true,
    lines: ['If you\'re heading out, travel light and come back heavy — with stories.', 'A genin went out alone last week and came back carried. Take your squad seriously.'],
  },
  {
    name: 'Haruki', title: 'Academy Instructor', arch: 'leaf_guard', frame: 'm', work: 'academy', hours: [7, 18],
    lines: [
      'Every fighter shows their intent a heartbeat early. A strike can\'t get through a guard; a guard won\'t survive a break; a break is too slow for a strike.',
      'Win an exchange and your rhythm builds — tempo. Spend it to slip away, or to vanish with a Kawarimi.',
      'If you can\'t read them, guard. Guarding costs you nothing and loses only to a break.',
    ],
  },
  {
    name: 'Daichi', title: 'Genin', arch: 'sparring', frame: 'm', work: 'training', hours: [8, 17],
    lines: ['Hey! Spar with me sometime. I\'ve been practicing my break all week.', 'Training alone is boring. Dummies don\'t hit back.', 'I heard you can see someone\'s next move if you\'re good enough. Creepy.'],
  },
  {
    name: 'Mio', title: 'Genin', arch: 'sparring', frame: 'f', work: 'training', hours: [9, 18],
    lines: ['Sneak with your knees bent and you can watch their sight lines. Sensei taught us that.', 'Tall grass is your best friend. Torches are your worst enemy.', 'Throw from the shadows — an unaware target can\'t dodge.'],
  },
  {
    name: 'Tetsuo', title: 'Weaponsmith', arch: 'villager', frame: 'm', work: 'shop', hours: [8, 19], post: true, recipient: true,
    lines: ['Kunai, shuriken, bandages. Pick them up after you throw them — I\'m not running a charity.', 'A kunai in the hand makes every fight lethal. Think about whether you want that.'],
  },
  {
    name: 'Old Tokuji', title: 'Ramen Chef', arch: 'villager', frame: 'm', work: 'ramen', hours: [10, 23], post: true, recipient: true,
    lines: ['A bowl of broth fixes most things. The rest, the hospital fixes.', 'You look hungry. You always look hungry. Shinobi.'],
  },
  {
    name: 'Dr. Rei Shimizu', title: 'Medic', arch: 'villager', frame: 'f', work: 'hospital', hours: [7, 20], post: true, recipient: true,
    lines: ['A knocked-out foe who is bleeding will be dead in under a minute. Bandage them if you want them alive.', 'Rest heals. Sleep heals more. Ignoring wounds heals nothing.'],
  },
  {
    name: 'Kotone', title: 'Mission Desk', arch: 'leaf_guard', frame: 'f', work: 'tower', hours: [7, 19], post: true,
    lines: ['New requests come in every morning. Check the board inside.', 'Finish three village jobs and the desk will trust you with C-rank work.'],
  },
  {
    name: 'Gonbei', title: 'Farmer', arch: 'villager', frame: 'm', work: 'fields', hours: [5, 17], recipient: true,
    lines: ['Rain\'s coming. My knee says so.', 'Bandits took two carts of rice last month. Somebody ought to do something.'],
  },
  {
    name: 'Ume', title: 'Florist', arch: 'villager', frame: 'f', work: 'market', hours: [8, 18], recipient: true,
    lines: ['Sakura season! Everyone is sneezing and happy.', 'You shinobi trample my flowers on your way to save the world.'],
  },
  {
    name: 'Ishida', title: 'Merchant', arch: 'villager', frame: 'm', work: 'market', hours: [8, 19], recipient: true,
    lines: ['Prices are up. The roads aren\'t safe, so caravans hire guards, so prices are up.', 'If you ever escort a caravan, keep the client behind you. Clients panic.'],
  },
  {
    name: 'Old Jiro', title: 'Fisherman', arch: 'villager', frame: 'm', work: 'river', hours: [5, 15], recipient: true,
    lines: ['Forty years on this river. The fish are smarter now.', 'Saw a chunin walk across the river once. Didn\'t even get her sandals wet.'],
  },
  {
    name: 'Mrs. Mori', title: 'Tea Seller', arch: 'villager', frame: 'f', work: 'plaza', hours: [9, 20], recipient: true,
    lines: ['Tea? It\'s good for chakra, they say. I say it\'s good for gossip.', 'The Hokage hasn\'t slept in days, I hear. Rogue ninja on the border.'],
  },
  {
    name: 'Isamu', title: 'Carpenter', arch: 'villager', frame: 'm', work: 'plaza', hours: [7, 17], recipient: true,
    lines: ['I build them, you ninja jump on their roofs. Cycle of life.'],
  },
  {
    name: 'Yuta', title: 'Child', arch: 'villager', frame: 'm', work: 'plaza', hours: [8, 19],
    lines: ['When I grow up I\'m going to be Hokage! Or a fisherman.', 'Show me a jutsu! Please please please.'],
  },
  {
    name: 'Hana', title: 'Child', arch: 'villager', frame: 'f', work: 'training', hours: [9, 17],
    lines: ['I can do the hand signs already. Rat, Ox, Tiger… then I forget.'],
  },
  {
    name: 'Ryoken', title: 'Wandering Monk', arch: 'villager', frame: 'm', work: 'river', hours: [6, 20], recipient: true,
    lines: ['Stillness is a weapon few shinobi carry.', 'Meditate by water. Chakra flows like it.'],
  },
  {
    name: 'Kasumi', title: 'Seamstress', arch: 'villager', frame: 'f', work: 'market', hours: [9, 18], recipient: true,
    lines: ['Another torn sleeve? Your sensei must be very proud.'],
  },
  {
    name: 'Bunzo', title: 'Retired Jonin', arch: 'villager', frame: 'm', work: 'plaza', hours: [10, 21],
    lines: ['In my day we didn\'t read intents. We guessed, and the good ones guessed right.', 'Never chase a fleeing bandit into the woods at night. That\'s how they get you.'],
  },
  {
    name: 'Nobuko', title: 'Baker', arch: 'villager', frame: 'f', work: 'market', hours: [5, 14], recipient: true,
    lines: ['Fresh bread! Well. Fresh this morning.'],
  },
  {
    name: 'Takumi', title: 'Courier', arch: 'villager', frame: 'm', work: 'gate', hours: [7, 18], recipient: true,
    lines: ['Letters, packages, gossip. I deliver all three.'],
  },
];
