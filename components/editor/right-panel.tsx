"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SolverPanel } from "./solver-panel";
import { ScorePanel } from "./score-panel";
import { FlowPanel } from "./flow-panel";

export function RightPanel() {
  return (
    <Tabs defaultValue="solver" className="flex h-full flex-col">
      <div className="border-b px-3 pt-3">
        <TabsList className="w-full">
          <TabsTrigger value="solver" className="flex-1">
            Solver
          </TabsTrigger>
          <TabsTrigger value="score" className="flex-1">
            Score
          </TabsTrigger>
          <TabsTrigger value="flows" className="flex-1">
            Flows
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <TabsContent value="solver" className="mt-0">
          <SolverPanel />
        </TabsContent>
        <TabsContent value="score" className="mt-0">
          <ScorePanel />
        </TabsContent>
        <TabsContent value="flows" className="mt-0">
          <FlowPanel />
        </TabsContent>
      </div>
    </Tabs>
  );
}
