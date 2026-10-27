// Side-effect imports — each module calls registerHandCard()/registerMission()
// when loaded. Importing this file once (from state.ts) registers every Hand
// Deck card before any deck is ever built.
import './jutsu';
import './assist';
import './terrain';
import './missions';
// Prototype rules only: placeholder Shinobi cards (shinobi.ts).
import '../shinobi';

export * from './registry';
