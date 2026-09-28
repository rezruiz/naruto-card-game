// Side-effect imports — each module calls registerCharacter() (and any
// combat hooks) when loaded. Importing this file once (from state.ts) is
// enough to make every character available to createCharacterInstance.
import './kakuzu';
import './hidan';
import './deidara';
import './kisame';
import './itachi';
import './konan';
import './juzo';
import './yahiko';
import './amegakureCivilianRebel';
import './sasori';
import './zetsu';
import './pain';
// Must load after every character/token registration above — it looks
// each one up by id to build the Character Deck entry table.
import './deckEntries';

export * from './registry';
export { makeThirdKazekage } from './sasori';
export { createSixPaths } from './pain';
export { getCharacterDeckEntry, CHARACTER_DECK_MANIFEST } from './deckEntries';
