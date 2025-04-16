import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  MessageSquare,
  Settings,
  Activity,
  Clock,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect } from "react";

interface Stats {
  total: number;
  successful: number;
}

interface PendingQuestion {
  id: number;
  questionId: string;
  productName: string;
  questionText: string;
  answer: string | null;
  processedAt: string;
  needsApproval: boolean;
}

export default function Home() {
  // Fetch pending questions
  const {
    data: pendingQuestions,
    isLoading: questionsLoading,
    refetch: refetchQuestions,
  } = useQuery<PendingQuestion[]>({
    queryKey: ["/api/questions/pending"],
    refetchInterval: 36000, // Refetch pendingQuestions every 36 seconds
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    enabled: false, // Fetch stats only after pendingQuestions is successfully fetched
  });

  // Trigger refresh of pendingQuestions when the page is revisited
  useEffect(() => {
    refetchQuestions();
  }, [refetchQuestions]);

  if (statsLoading || questionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const successRate = stats
    ? Math.round((stats.successful / stats.total) * 100) || 0
    : 0;

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">
            Trendyol Question Bot Dashboard
          </h1>
          <div className="flex gap-4">
            <Link href="/rate-limits">
              <Button variant="outline">
                <Activity className="mr-2 h-4 w-4" />
                API Limits
              </Button>
            </Link>
            <Link href="/approval">
              <Button>
                <MessageSquare className="mr-2 h-4 w-4" />
                Review Answers
              </Button>
            </Link>
            <Link href="/settings">
              <Button>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Total Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {pendingQuestions?.length || 0}
              </p>{" "}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Successful Answers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.successful || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{successRate}%</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Questions Queue</CardTitle>
            <Button variant="outline" size="sm">
              <Clock className="mr-2 h-4 w-4" />
              Last Updated: {new Date().toLocaleTimeString()}
            </Button>
          </CardHeader>
          <CardContent>
            {pendingQuestions && pendingQuestions.length > 0 ? (
              <div className="space-y-4">
                {pendingQuestions.map((question) => (
                  <div
                    key={question.id}
                    className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {question.productName}
                        </h3>
                        <span className="text-sm text-muted-foreground">
                          Question ID: {question.questionId}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(question.processedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-sm font-medium">Question:</p>
                      <p className="text-sm bg-slate-50 p-3 rounded">
                        {question.questionText}
                      </p>
                    </div>

                    <div className="flex justify-between items-center">
                      <Link href={`/approval/${question.questionId}`}>
                        <Button variant="outline" size="sm">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Review Answer
                        </Button>
                      </Link>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                        <span className="text-sm text-muted-foreground">
                          Awaiting Review
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No questions in the queue.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
