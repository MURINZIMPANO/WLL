import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Chip } from '../components/Chip';

const meta = {
  title: 'Foundations/Chip',
  component: Chip,
  tags: ['autodocs'],
  args: { children: 'Pop', selected: false },
  argTypes: { size: { control: 'select', options: ['sm', 'md'] } },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

const CATEGORIES = ['All', 'Pop', 'Hip-hop', 'Afrobeats', 'Gospel', 'Movies', 'Tutorials'];

/** Extracted to a component so the hook is legal — a story `render` is not one. */
function InteractiveChips(args: React.ComponentProps<typeof Chip>) {
  const [selected, setSelected] = useState('All');
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((category) => (
        <Chip
          key={category}
          {...args}
          selected={selected === category}
          onClick={() => {
            setSelected(category);
          }}
        >
          {category}
        </Chip>
      ))}
    </div>
  );
}

export const Interactive: Story = {
  render: (args) => <InteractiveChips {...args} />,
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Chip {...args} size="sm">
        Small
      </Chip>
      <Chip {...args} size="md">
        Medium
      </Chip>
    </div>
  ),
};
