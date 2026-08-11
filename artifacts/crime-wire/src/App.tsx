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
import Standards from '@/pages/standards';
import Edition from '@/pages/edition';
import Admin from '@/pages/admin';
import ReportPage from '@/pages/report';

// Crime Wire sub-routes
import CwArchive from '@/pages/cw-archive';
import CwReaderDesk from '@/pages/cw-reader-desk';
import CwPressClub from '@/pages/cw-press-club';
import CwCorrections from '@/pages/cw-corrections';
import CwGameDesk from '@/pages/cw-game-desk';
import CwMarket from '@/pages/cw-market';
import CwPaperTrail from '@/pages/cw-paper-trail';
import CwMorgue from '@/pages/cw-morgue';
import CwTheFunnies from '@/pages/cw-the-funnies';

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
            <Route path="/standards" component={Standards} />
            <Route path="/edition" component={Edition} />

            {/* Public report pages */}
            <Route path="/report/:id" component={ReportPage} />

            {/* Crime Wire hub and sub-routes */}
            <Route path="/crime-wire" component={CrimeWire} />
            <Route path="/crime-wire/archive" component={CwArchive} />
            <Route path="/crime-wire/reader-desk" component={CwReaderDesk} />
            <Route path="/crime-wire/press-club" component={CwPressClub} />
            <Route path="/crime-wire/corrections" component={CwCorrections} />
            <Route path="/crime-wire/game-desk" component={CwGameDesk} />
            <Route path="/crime-wire/market" component={CwMarket} />
            <Route path="/crime-wire/paper-trail" component={CwPaperTrail} />
            <Route path="/crime-wire/morgue" component={CwMorgue} />
            <Route path="/crime-wire/the-funnies" component={CwTheFunnies} />

            {/* Legacy: /reader-desk → Crime Wire reader desk */}
            <Route path="/reader-desk" component={CwReaderDesk} />

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
