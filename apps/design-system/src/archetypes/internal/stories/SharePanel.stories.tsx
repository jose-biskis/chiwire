import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert, AlertDescription, AlertTitle } from "../components/alert";
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
  title: "Archetypes/Internal/Examples/Share panel",
  parameters: { layout: "padded" }
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Contimiti-shaped composition: card + tabs + fields + status. */
export const CreateShare: Story = {
  render: () => (
    <div className="w-[min(32rem,92vw)] space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Contimiti</h1>
        <p className="text-sm text-muted-foreground">
          Share a note or a file for a day.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create a share</CardTitle>
          <CardDescription>Text stays editable; files are upload/download only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="text">
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="file">File</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="share-note">Note</Label>
                <Textarea id="share-note" placeholder="Paste something worth sharing…" />
              </div>
              <Button>Create text share</Button>
            </TabsContent>
            <TabsContent value="file" className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="share-file">File</Label>
                <Input id="share-file" type="file" />
              </div>
              <Button>Upload file share</Button>
            </TabsContent>
          </Tabs>

          <Alert variant="success">
            <AlertTitle>Share created</AlertTitle>
            <AlertDescription className="font-mono text-xs break-all">
              https://contimiti.example/s/demo-token
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
};
