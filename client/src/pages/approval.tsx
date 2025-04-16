import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useParams, useLocation } from "wouter";

interface PendingQuestion {
  id: number;
  questionId: string;
  productName: string;
  questionText: string;
  answer: string | null;
  public: boolean | false;
  followUp: boolean | false;
}

export const getPendingQuestion = async (questionId: any) => {
  const response = await fetch(`/api/pending-approval/${questionId}`);
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return response.json();
};

export default function ApprovalPage() {
  const { toast } = useToast();
  const [editedAnswer, setEditedAnswer] = useState("");
  const params = useParams();
  const questionId = params?.questionId;
  // Get location setter function
  const [_, setLocation] = useLocation();

  const { data: pendingQuestion, isLoading } = useQuery<PendingQuestion | null>(
    {
      queryKey: ["/api/pending-approval", questionId],
      queryFn: async () => {
        const data = await getPendingQuestion(questionId);
        return data;
      },
      staleTime: 0,
      // Only auto-refresh if no specific questionId is provided
      refetchInterval: questionId ? false : 5000,
      refetchIntervalInBackground: !questionId,
      refetchOnWindowFocus: !questionId,
    },
  );

  const approveMutation = useMutation({
    mutationFn: async ({
      approved,
      answer,
    }: {
      approved: boolean;
      answer?: string;
    }) => {
      const controller = new AbortController(); // Create an AbortController instance
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Set a 10s timeout

      try {
        const response = await fetch("/api/approve", {
          signal: controller.signal, // Attach the AbortController signal
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: pendingQuestion?.questionId,
            approved,
            answer,
          }),
        });

        clearTimeout(timeoutId); // Clear the timeout once the request is done

        if (!response.ok) {
          throw new Error("Failed to process the request."); // Throw an error for non-200 responses
        }

        return response;
      } catch (err) {
        clearTimeout(timeoutId); // Make sure timeout is cleared in case of errors
        throw err; // Ensure React Query handles the error properly
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/questions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Response processed successfully",
      });
      setEditedAnswer("");
      // Add a small delay (e.g., 2 seconds) before navigating to home
      setTimeout(() => {
        setLocation("/");
      }, 2000); // Delay in milliseconds
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          "Something went wrong when processing the request. Please try again.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!pendingQuestion) {
    return (
      <div className="min-h-screen p-8">
        <Card>
          <CardHeader>
            <CardTitle>No Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <p>There are no answers waiting for approval at the moment.</p>
            <Link href="/">
              <Button className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Review Answer</CardTitle>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to List
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Product</h3>
            <p>{pendingQuestion.productName}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Question</h3>
            <p>{pendingQuestion.questionText}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Draft Answer from Chatbase</h3>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              <p className="text-slate-900 dark:text-slate-100">
                {pendingQuestion.answer ||
                  "Waiting for Chatbase to generate an answer..."}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Edit Answer</h3>
            <Textarea
              value={editedAnswer || pendingQuestion.answer || ""}
              onChange={(e) => setEditedAnswer(e.target.value)}
              rows={6}
              placeholder="Edit the answer before approving..."
              className="w-full"
            />
          </div>

          <div>
            <h3 className="font-semibold mb-2">Public</h3>

            <p>
              {pendingQuestion.public
                ? "Herkese açık soru"
                : "Herkese kapalı soru"}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Follow-up Sorusu</h3>

            <p>
              {pendingQuestion.followUp
                ? "Evet, bu soru bir devam sorusudur."
                : "Hayır, bu soru bir devam sorusu degildir"}
            </p>
          </div>

          <div className="flex space-x-4">
            <Button
              onClick={() =>
                approveMutation.mutate({
                  approved: true,
                  answer: editedAnswer || pendingQuestion.answer || "",
                })
              }
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => approveMutation.mutate({ approved: false })}
              disabled={approveMutation.isPending}
            >
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
