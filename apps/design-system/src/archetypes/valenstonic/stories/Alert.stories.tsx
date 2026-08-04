import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert, AlertDescription, AlertTitle } from "../components/alert";

const meta = {
  title: "Archetypes/Valenstonic/Alert",
  component: Alert,
  parameters: { layout: "padded" }
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert className="w-[min(28rem,90vw)]">
      <AlertTitle>Ready when you are</AlertTitle>
      <AlertDescription>Open the lab to begin measuring.</AlertDescription>
    </Alert>
  )
};

export const Success: Story = {
  render: () => (
    <Alert variant="success" className="w-[min(28rem,90vw)]">
      <AlertTitle>Pour complete</AlertTitle>
      <AlertDescription>Your Negroni ratios look balanced.</AlertDescription>
    </Alert>
  )
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="w-[min(28rem,90vw)]">
      <AlertTitle>Ratio off</AlertTitle>
      <AlertDescription>Campari is running heavy — dial it back.</AlertDescription>
    </Alert>
  )
};
