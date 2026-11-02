import type { Meta, StoryObj } from "@storybook/react";
import { DelishLogo } from "@/components/delish/DelishLogo";

const meta = {
  title: "Delish/DelishLogo",
  component: DelishLogo,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DelishLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: "default",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
  },
};
