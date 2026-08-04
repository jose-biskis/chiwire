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
  title: "Archetypes/Valenstonic/Card",
  component: Card,
  parameters: { layout: "padded" }
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[min(24rem,90vw)]">
      <CardHeader>
        <CardTitle>Negroni lab</CardTitle>
        <CardDescription>Build the classic in the 3D practice room.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Flat charcoal surfaces with thin rose borders — no card chrome in the hero.
        </p>
      </CardContent>
      <CardFooter>
        <Button>Start practice</Button>
      </CardFooter>
    </Card>
  )
};
