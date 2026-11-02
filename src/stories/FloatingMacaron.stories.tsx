import type { Meta, StoryObj } from "@storybook/react";
import { FloatingMacaron } from "@/components/delish/FloatingMacaron";
import pistachioMacaron from "@/assets/macaron-pistachio.webp";
import roseMacaron from "@/assets/macaron-rose.webp";
import berryMacaron from "@/assets/macaron-berry.webp";
import peachMacaron from "@/assets/macaron-peach.webp";

const meta = {
  title: "Delish/FloatingMacaron",
  component: FloatingMacaron,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FloatingMacaron>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pistachio: Story = {
  args: {
    src: pistachioMacaron,
    alt: "Pistachio macaron",
    className: "w-48 h-48 relative",
  },
};

export const Rose: Story = {
  args: {
    src: roseMacaron,
    alt: "Rose pink macaron",
    className: "w-48 h-48 relative",
  },
};

export const Berry: Story = {
  args: {
    src: berryMacaron,
    alt: "Berry pink macaron",
    className: "w-48 h-48 relative",
  },
};

export const Peach: Story = {
  args: {
    src: peachMacaron,
    alt: "Warm peach macaron",
    className: "w-48 h-48 relative",
  },
};
