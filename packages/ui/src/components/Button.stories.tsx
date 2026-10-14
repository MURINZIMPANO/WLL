import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, Play, Sparkles } from 'lucide-react';

import { Button } from '../components/Button';

const meta = {
  title: 'Foundations/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Pill buttons, the primary action shape. `md` and above are at least 44px tall, meeting the minimum touch target; `sm` is for dense desktop chrome only.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'outline', 'danger'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
  },
  args: { children: 'Play lyrics', variant: 'primary', size: 'md' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const AllVariants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args}>Primary</Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="outline">
        Outline
      </Button>
      <Button {...args} variant="danger">
        Delete
      </Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
      <Button {...args} size="icon" aria-label="Play">
        <Play aria-hidden className="size-5 fill-current" />
      </Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} leftIcon={<Play aria-hidden className="size-4" />}>
        Resume
      </Button>
      <Button {...args} variant="secondary" rightIcon={<Sparkles aria-hidden className="size-4" />}>
        Improve lyrics
      </Button>
      <Button {...args} variant="outline" leftIcon={<Download aria-hidden className="size-4" />}>
        Export LRC
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true, children: 'Fetching lyrics' },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const AsLink: Story = {
  render: (args) => (
    <Button {...args} asChild>
      <a href="https://lrclib.net" target="_blank" rel="noreferrer">
        Lyrics from LRCLIB
      </a>
    </Button>
  ),
};
