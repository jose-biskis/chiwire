import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../components/card";
import { Button } from "../components/button";

const meta = {
  title: "Archetypes/Internal/Card",
  component: Card,
  parameters: { layout: "padded" }
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[min(24rem,90vw)]">
      <CardHeader>
        <CardTitle>Create a share</CardTitle>
        <CardDescription>Notes and files expire after one day.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Contimiti uses a panel like this for the create form.
        </p>
      </CardContent>
      <CardFooter>
        <Button>Continue</Button>
      </CardFooter>
    </Card>
  )
};
