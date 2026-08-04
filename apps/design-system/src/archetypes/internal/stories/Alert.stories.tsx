import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert, AlertDescription, AlertTitle } from "../components/alert";

const meta = {
  title: "Archetypes/Internal/Alert",
  component: Alert,
  parameters: { layout: "padded" }
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert className="w-[min(28rem,90vw)]">
      <AlertTitle>Ready</AlertTitle>
      <AlertDescription>Waiting for a share to be created.</AlertDescription>
    </Alert>
  )
};

export const Success: Story = {
  render: () => (
    <Alert variant="success" className="w-[min(28rem,90vw)]">
      <AlertTitle>Share created</AlertTitle>
      <AlertDescription className="font-mono text-xs break-all">
        https://example.com/s/abc123
      </AlertDescription>
    </Alert>
  )
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="w-[min(28rem,90vw)]">
      <AlertTitle>Upload failed</AlertTitle>
      <AlertDescription>The file could not be saved. Try again.</AlertDescription>
    </Alert>
  )
};
