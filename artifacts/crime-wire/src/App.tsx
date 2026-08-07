import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import Layout from '@/components/Layout';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import CaseFiles from '@/pages/case-files';
import CityDesk from '@/pages/city-desk';
import RecordsDesk from '@/pages/records-desk';
import CrimeWire from '@/pages/crime-wire';
import ReaderDesk from '@/pages/reader-desk';
import Standards from '@/pages/standards';
import Edition from '@/pages/edition';
import Admin from '@/pages/admin';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={Admin} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/case-files" component={CaseFiles} />
            <Route path="/city-desk" component={CityDesk} />
            <Route path="/records-desk" component={RecordsDesk} />
            <Route path="/crime-wire" component={CrimeWire} />
            <Route path="/reader-desk" component={ReaderDesk} />
            <Route path="/standards" component={Standards} />
            <Route path="/edition" component={Edition} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
