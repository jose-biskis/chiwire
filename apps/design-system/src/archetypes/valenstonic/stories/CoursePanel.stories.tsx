import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert, AlertDescription, AlertTitle } from "../components/alert";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../components/card";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { Textarea } from "../components/textarea";

const meta = {
  title: "Archetypes/Valenstonic/Examples/Course panel",
  parameters: { layout: "padded" }
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Composition in Valen's Tonic voice — script brand + rose atelier chrome. */
export const EnrollDraft: Story = {
  render: () => (
    <div
      className="w-[min(32rem,92vw)] space-y-5 rounded-xl p-6"
      style={{ background: "var(--archetype-surface-tint)" }}
    >
      <div className="space-y-1">
        <p className="font-script text-4xl text-primary">Valen's Tonic</p>
        <p className="text-sm text-muted-foreground">
          Draft a lesson note before you step into the lab.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <CardTitle>Practice brief</CardTitle>
            <Badge>Lab</Badge>
          </div>
          <CardDescription>Keep it short — one pour, one focus.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="brief">
            <TabsList>
              <TabsTrigger value="brief">Brief</TabsTrigger>
              <TabsTrigger value="asset">Asset</TabsTrigger>
            </TabsList>
            <TabsContent value="brief" className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="vt-brief">Notes</Label>
                <Textarea id="vt-brief" placeholder="Equal parts gin, vermouth, Campari…" />
              </div>
              <Button>Save brief</Button>
            </TabsContent>
            <TabsContent value="asset" className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="vt-asset">Reference</Label>
                <Input id="vt-asset" type="file" />
              </div>
              <Button variant="secondary">Attach</Button>
            </TabsContent>
          </Tabs>

          <Alert variant="success">
            <AlertTitle>Brief saved</AlertTitle>
            <AlertDescription>Open the Negroni lab when you’re ready.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
};
