import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Badge,
  Button,
  Card,
  Chip,
  Input,
  MediaCard,
  PlayerControls,
  ProgressRing,
  Skeleton,
} from '../src/index.js';

describe('Button', () => {
  it('renders children and defaults to type="button"', () => {
    render(<Button>Play</Button>);
    const button = screen.getByRole('button', { name: 'Play' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Play</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disables the button and hides it from assistive tech when loading', () => {
    render(<Button loading>Play</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('never submits a surrounding form by accident', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button>Play</Button>
      </form>,
    );
    screen.getByRole('button').click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders as the child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/app/library">Open library</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Open library' });
    expect(link).toHaveAttribute('href', '/app/library');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('merges a caller className over the variant classes', () => {
    render(<Button className="w-full">Play</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('w-full');
    expect(button.className).toContain('bg-accent');
  });
});

describe('Chip', () => {
  it('exposes selection state to assistive tech', () => {
    render(<Chip selected>Pop</Chip>);
    expect(screen.getByRole('button', { name: 'Pop' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('is unselected by default', () => {
    render(<Chip>Pop</Chip>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Chip onClick={onClick}>Pop</Chip>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Card', () => {
  it('applies the signature radius by default', () => {
    const { container } = render(<Card>content</Card>);
    expect(container.firstElementChild).toHaveClass('rounded-card');
  });

  it('supports the larger hero radius', () => {
    const { container } = render(<Card radius="xl">content</Card>);
    expect(container.firstElementChild).toHaveClass('rounded-xl');
  });

  it('is padding-none when asked, so media can bleed to the edge', () => {
    const { container } = render(<Card padding="none">content</Card>);
    expect(container.firstElementChild?.className).not.toContain('p-5');
  });
});

describe('Badge', () => {
  it('renders its tone', () => {
    render(<Badge tone="success">Synced</Badge>);
    expect(screen.getByText('Synced')).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('associates the label with the field', async () => {
    const user = userEvent.setup();
    render(<Input label="Song title" />);
    await user.type(screen.getByLabelText('Song title'), 'a');
    expect(screen.getByLabelText('Song title')).toHaveValue('a');
  });

  it('announces an error and links it via aria-describedby', () => {
    render(<Input label="Song title" error="Required" />);
    const input = screen.getByLabelText('Song title');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('shows a hint when there is no error', () => {
    render(<Input label="Song title" hint="Try the artist too" />);
    expect(screen.getByText('Try the artist too')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive tech', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ProgressRing', () => {
  it('exposes a progressbar role with a live value', () => {
    render(<ProgressRing value={0.42} label="Playback progress" />);
    const ring = screen.getByRole('progressbar', { name: 'Playback progress' });
    expect(ring).toHaveAttribute('aria-valuenow', '42');
    expect(ring).toHaveAttribute('aria-valuemin', '0');
    expect(ring).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps values outside 0..1', () => {
    const { rerender } = render(<ProgressRing value={-3} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    rerender(<ProgressRing value={9} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('treats NaN as zero rather than rendering NaN', () => {
    render(<ProgressRing value={Number.NaN} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('MediaCard', () => {
  it('renders the title and subtitle', () => {
    render(<MediaCard title="Hey Ya" subtitle="OutKast" />);
    expect(screen.getByRole('heading', { name: 'Hey Ya' })).toBeInTheDocument();
    expect(screen.getByText('OutKast')).toBeInTheDocument();
  });

  it('marks cover art decorative so it is not announced twice', () => {
    render(<MediaCard title="Hey Ya" coverUrl="https://example.test/cover.jpg" />);
    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute('alt', '');
  });

  it('omits the subtitle element when there is none', () => {
    const { container } = render(<MediaCard title="Hey Ya" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});

describe('PlayerControls', () => {
  it('gives every icon-only control an accessible name', () => {
    render(
      <PlayerControls
        playing={false}
        onTogglePlay={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onShuffle={vi.fn()}
        onCycleRepeat={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    for (const name of [
      'Shuffle',
      'Previous line',
      'Play',
      'Next line',
      'Repeat: off',
      'Add to favourites',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('reflects the playing state on the play/pause button', () => {
    const { rerender } = render(<PlayerControls playing onTogglePlay={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');

    rerender(<PlayerControls playing={false} onTogglePlay={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('swaps the repeat label with the mode', () => {
    render(
      <PlayerControls
        playing={false}
        onTogglePlay={vi.fn()}
        repeatMode="one"
        onCycleRepeat={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Repeat: one' })).toBeInTheDocument();
  });

  it('fires the transport callbacks', async () => {
    const user = userEvent.setup();
    const onTogglePlay = vi.fn();
    const onNext = vi.fn();
    const onToggleFavorite = vi.fn();

    render(
      <PlayerControls
        playing={false}
        onTogglePlay={onTogglePlay}
        onNext={onNext}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await user.click(screen.getByRole('button', { name: 'Next line' }));
    await user.click(screen.getByRole('button', { name: 'Add to favourites' }));

    expect(onTogglePlay).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onToggleFavorite).toHaveBeenCalledOnce();
  });

  it('hides controls whose handler is not supplied', () => {
    render(<PlayerControls playing={false} onTogglePlay={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Shuffle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Repeat: off' })).not.toBeInTheDocument();
  });
});
