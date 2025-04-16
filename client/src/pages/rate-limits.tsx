import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ApiStat {
  timestamp: string;
  responseTime: number;
  success: boolean;
  rateLimitRemaining: number | null;
}

interface RateLimitConfig {
  endpoint: string;
  requestsPerMinute: number;
  enabled: boolean;
}

const ENDPOINTS = [
  'trendyol-questions',
  'trendyol-answers',
  'chatbase'
];

export default function RateLimitsPage() {
  const { toast } = useToast();
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  
  const { data: stats, isLoading: statsLoading } = useQuery<ApiStat[]>({
    queryKey: ['/api/rate-limits/stats', selectedEndpoint],
  });

  const { data: config, isLoading: configLoading } = useQuery<RateLimitConfig>({
    queryKey: ['/api/rate-limits/config', selectedEndpoint],
  });

  const updateConfig = useMutation({
    mutationFn: async (newConfig: Partial<RateLimitConfig>) => {
      return await fetch(`/api/rate-limits/config/${selectedEndpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rate-limits/config'] });
      toast({
        title: "Success",
        description: "Rate limit configuration updated",
      });
    },
  });

  if (statsLoading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">API Rate Limiting Dashboard</h1>
          <div className="flex gap-4">
            {ENDPOINTS.map(endpoint => (
              <Button
                key={endpoint}
                variant={selectedEndpoint === endpoint ? "default" : "outline"}
                onClick={() => setSelectedEndpoint(endpoint)}
              >
                {endpoint}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label>Enabled</label>
                <Switch
                  checked={config?.enabled}
                  onCheckedChange={(enabled) => 
                    updateConfig.mutate({ enabled })
                  }
                />
              </div>
              <div className="space-y-2">
                <label>Requests per minute</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={config?.requestsPerMinute}
                    onChange={(e) => 
                      updateConfig.mutate({ 
                        requestsPerMinute: parseInt(e.target.value) 
                      })
                    }
                  />
                  <Button variant="outline">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>API Response Times</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Remaining Rate Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="rateLimitRemaining"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
