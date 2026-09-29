// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';

// A minimal but real render-to-DOM smoke test — no browser is available in
// this sandbox (Playwright's Chromium download times out here), so this is
// the closest substitute: it catches mount-time crashes (bad imports, wrong
// prop names, undefined component references) that `tsc` alone can't, for
// the one part of the app the 126 engine unit tests never actually render.
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

    // Each player's reveal panel offers 3+ character buttons (Rank X) —
    // click the first one for whichever panel is still open, twice (P1 then
    // P2), which should clear setup and land on the live board.
    for (let i = 0; i < 2; i++) {
      const panels = screen.getAllByText(/choose a starting character/i);
      expect(panels.length).toBeGreaterThan(0);
      const panel = panels[0].closest('.reveal-panel')!;
      const firstChoice = panel.querySelector('button')!;
      fireEvent.click(firstChoice);
    }

    expect(screen.queryByText(/choose a starting character/i)).toBeNull();
    expect(screen.getAllByText(/^HP \d+\/\d+/).length).toBeGreaterThan(0);
    // Trust mode: no click-through of Untap/Upkeep/Draw — setup lands straight on Main 1, with Resolve/Finalize controls.
    expect(screen.getByRole('button', { name: /finalize main1 phase/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /resolve actions/i })).toBeTruthy();
  });

  it('shows minimized in-play cards and opens the full SPEC text in a popup on click', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /single-player testing/i }));
    for (let i = 0; i < 2; i++) {
      const panel = screen.getAllByText(/choose a starting character/i)[0].closest('.reveal-panel')!;
      fireEvent.click(panel.querySelector('button')!);
    }

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
    for (let i = 0; i < 2; i++) {
      const panel = screen.getAllByText(/choose a starting character/i)[0].closest('.reveal-panel')!;
      fireEvent.click(panel.querySelector('button')!);
    }

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
