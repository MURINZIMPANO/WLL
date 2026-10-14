import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ToastProvider, useToast } from '../components/Toast';

const overlays = {
  title: 'Overlays',
  tags: ['autodocs'],
} satisfies Meta;

export default overlays;
type Story = StoryObj<typeof overlays>;

function SheetDemo({ side }: { side: 'bottom' | 'side' }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-96">
      <Button onClick={() => setOpen(true)}>
        Open {side === 'bottom' ? 'bottom sheet' : 'side panel'}
      </Button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        side={side}
        title="Sync offset"
        description="Positive values delay the highlighted line."
      >
        <div className="space-y-4">
          <Input label="Offset (ms)" defaultValue="120" />
          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)}>Done</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

export const BottomSheet: Story = {
  render: () => <SheetDemo side="bottom" />,
};

export const SidePanel: Story = {
  render: () => <SheetDemo side="side" />,
};

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={() => {
          toast({ title: 'Lyrics synced', description: 'Source: LRCLIB.' });
        }}
      >
        Info
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          toast({ title: 'Saved to library', tone: 'success' });
        }}
      >
        Success
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          toast({
            title: 'No lyrics found',
            description: 'Try adjusting the offset or uploading your own timings.',
            tone: 'warning',
          });
        }}
      >
        Warning
      </Button>
      <Button
        variant="danger"
        onClick={() => {
          toast({
            title: 'Recognition failed',
            description: 'The provider is unreachable. Check your connection.',
            tone: 'danger',
          });
        }}
      >
        Danger
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          toast({
            title: 'Export ready',
            description: 'lyriclens-ye.lrc',
            action: { label: 'Download', onClick: () => undefined },
            durationMs: 0,
          });
        }}
      >
        With action (sticky)
      </Button>
    </div>
  );
}

export const Toasts: Story = {
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  render: () => <ToastDemo />,
};
