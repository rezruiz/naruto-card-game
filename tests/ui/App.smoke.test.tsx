// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';

// A minimal but real render-to-DOM smoke test — no browser is available in
// this sandbox (Playwright's Chromium download times out here), so this is
// the closest substitute: it catches mount-time crashes (bad imports, wrong
// prop names, undefined component references) that `tsc` alone can't, for
// the one part of the app the 126 engine unit tests never actually render.
/** Both players pick their first revealed character: select it, then Confirm (picking is two-step). */
function pickBothStartingCharacters() {
  for (let i = 0; i < 2; i++) {
    const panel = screen.getAllByText(/choose a starting character/i)[0].closest('.reveal-panel')!;
    fireEvent.click(panel.querySelector('.reveal-panel__option button')!);
    fireEvent.click(panel.querySelector('.reveal-panel__confirm-button')!);
  }
}

describe('App (smoke)', () => {
  afterEach(cleanup);

  it('renders the lobby without crashing', () => {
    render(<App />);
    expect(screen.getByText(/naruto custom card game/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /single-player testing/i })).toBeTruthy();
  });

  it('starts a local hotseat game and renders the board without crashing', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /single-player testing/i }));
    // Setup is pending immediately after starting — a reveal panel or
    // mulligan control for at least one player should be present, and the
    // phase indicator should have mounted alongside it.
    expect(screen.getAllByText(/choose (a starting character|a reinforcement)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/turn 1/i)).toBeTruthy();
  });

  it('lets both players pick a starting character through the reveal panel and reach the live board', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /single-player testing/i }));

    // Selecting a character alone commits nothing — it takes Confirm.
    const panel = screen.getAllByText(/choose a starting character/i)[0].closest('.reveal-panel')!;
    fireEvent.click(panel.querySelector('.reveal-panel__option button')!);
    expect(screen.getAllByText(/choose a starting character/i)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /mulligan/i })).toHaveLength(2); // both players can still mulligan
    fireEvent.click(panel.querySelector('.reveal-panel__confirm-button')!);
    expect(screen.getAllByText(/choose a starting character/i)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /mulligan/i })).toHaveLength(1); // only the player still in setup
    const other = screen.getAllByText(/choose a starting character/i)[0].closest('.reveal-panel')!;
    fireEvent.click(other.querySelector('.reveal-panel__option button')!);
    fireEvent.click(other.querySelector('.reveal-panel__confirm-button')!);

    expect(screen.queryByText(/choose a starting character/i)).toBeNull();
    expect(screen.getAllByText(/^HP \d+\/\d+/).length).toBeGreaterThan(0);
    expect(screen.getByText(/coin flip: p[12] goes first/i)).toBeTruthy();
    // Trust mode: Untap/Upkeep run on their own and the first player's skipped first draw passes through — setup lands on Main 1.
    expect(screen.getByRole('button', { name: /finalize main1 phase/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /resolve actions/i })).toBeTruthy();
  });

  it('shows minimized in-play cards and opens the full SPEC text in a popup on click', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /single-player testing/i }));
    pickBothStartingCharacters();

    // Hotseat has no single "you": P1 sits at the bottom, P2 across the table at the top.
    const boards = container.querySelectorAll('.player-board');
    expect(boards[0].className).toContain('player-board--top');
    expect(boards[1].className).toContain('player-board--bottom');
    expect(boards[0].textContent).toContain('P2');
    expect(boards[1].textContent).toContain('P1');

    // In-play cards are minimized: a name plus vitals, no ability buttons on the card itself.
    const card = container.querySelector('.character-card')!;
    expect(card.querySelector('.compact-card__name')!.textContent!.length).toBeGreaterThan(0);
    expect(card.querySelectorAll('button').length).toBe(1); // only the ⓘ button

    fireEvent.click(card);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.details-modal__text')!.textContent).toMatch(/Specialization|Traits|Abilities/);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the same details popup from a card in hand, without triggering its Play button', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /single-player testing/i }));
    pickBothStartingCharacters();

    const handCard = container.querySelector('.player-board--bottom .hand-card:not(.hand-card--hidden)')!;
    const name = handCard.querySelector('.hand-card__name')!.textContent!;
    fireEvent.click(handCard.querySelector('button')!); // Play — must not open the popup
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(handCard);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('h2')!.textContent).toBe(name);
    expect(dialog.querySelector('.details-modal__text')!.textContent!.length).toBeGreaterThan(20);
  });
});
