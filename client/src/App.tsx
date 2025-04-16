import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ApprovalPage from "@/pages/approval";
import RateLimitsPage from "@/pages/rate-limits";
import SettingsPage from "@/pages/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/approval" component={ApprovalPage} />
      <Route path="/approval/:questionId" component={ApprovalPage} />
      <Route path="/rate-limits" component={RateLimitsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
