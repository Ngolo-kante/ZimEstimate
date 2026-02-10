import type { Meta, StoryObj } from '@storybook/react';
import { Plus } from '@phosphor-icons/react';
import Button from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  args: {
    children: 'Primary action',
    variant: 'primary',
    size: 'md',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    children: 'Secondary action',
    variant: 'secondary',
  },
};

export const WithIcon: Story = {
  args: {
    children: 'Add item',
    icon: <Plus size={16} />,
  },
};

export const Loading: Story = {
  args: {
    children: 'Saving',
    loading: true,
  },
};
