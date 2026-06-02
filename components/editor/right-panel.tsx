"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SolverPanel } from "./solver-panel";
import { ScorePanel } from "./score-panel";
import { FlowPanel } from "./flow-panel";
import { InsightsPanel } from "./insights-panel";
import { RoiPanel } from "./roi-panel";

export function RightPanel() {
  return (
    <Tabs defaultValue="solver" className="flex h-full flex-col">
      <div className="border-b px-2 pt-3">
        <TabsList className="w-full">
          <TabsTrigger value="solver" className="flex-1 px-1 text-[11px]">
            Solver
          </TabsTrigger>
          <TabsTrigger value="score" className="flex-1 px-1 text-[11px]">
            Score
          </TabsTrigger>
          <TabsTrigger value="flows" className="flex-1 px-1 text-[11px]">
            Flows
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex-1 px-1 text-[11px]">
            Insights
          </TabsTrigger>
          <TabsTrigger value="roi" className="flex-1 px-1 text-[11px]">
            ROI
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
        <TabsContent value="insights" className="mt-0">
          <InsightsPanel />
        </TabsContent>
        <TabsContent value="roi" className="mt-0">
          <RoiPanel />
        </TabsContent>
      </div>
    </Tabs>
  );
}
