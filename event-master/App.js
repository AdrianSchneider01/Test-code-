// Import only the weights we use so the other Nunito files aren't bundled.
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Background } from './src/components/Brand';
import { BottomNav, SHELL_ROUTES, Sidebar } from './src/components/NavBar';
import { ToastProvider } from './src/components/ui';
import { EditEventScreen, EventScreen, EventsScreen, HomeScreen, ProfileScreen, ReviewChangesScreen, SavedIdeasScreen } from './src/screens/Account';
import { PlanCategoriesScreen, PlanEssentialsScreen, PlanTypeScreen } from './src/screens/CreateFlow';
import {
  ExampleScreen,
  ExploreHowScreen,
  ExploreIdeasScreen,
  ExplorePlanScreen,
  ExploreProductsScreen,
  ExploreScreen,
} from './src/screens/Explore';
import { MemoryPromptScreen, SplashScreen, WelcomeScreen } from './src/screens/Intro';
import { ItemScreen, OwnItemScreen, PartyPlanScreen, ReadyScreen, SuggestScreen } from './src/screens/Planning';
import { AppStateProvider } from './src/state/AppState';
import { NavigationProvider, useNav } from './src/state/Navigation';
import { colors, useLayout } from './src/theme';

const ROUTES = {
  splash: SplashScreen,
  welcome: WelcomeScreen,
  explore: ExploreScreen,
  exploreIdeas: ExploreIdeasScreen,
  exploreProducts: ExploreProductsScreen,
  explorePlan: ExplorePlanScreen,
  exploreHow: ExploreHowScreen,
  exploreExample: ExampleScreen,
  memoryPrompt: MemoryPromptScreen,
  plan1: PlanTypeScreen,
  plan2: PlanEssentialsScreen,
  plan3: PlanCategoriesScreen,
  party: PartyPlanScreen,
  suggest: SuggestScreen,
  item: ItemScreen,
  ownItem: OwnItemScreen,
  ready: ReadyScreen,
  home: HomeScreen,
  events: EventsScreen,
  event: EventScreen,
  editEvent: EditEventScreen,
  review: ReviewChangesScreen,
  profile: ProfileScreen,
  ideas: SavedIdeasScreen,
};

function Router() {
  const { route } = useNav();
  const { isDesktop } = useLayout();
  const Current = ROUTES[route.name] || HomeScreen;
  const inShell = SHELL_ROUTES.includes(route.name);

  if (inShell && isDesktop) {
    return (
      <View style={styles.row}>
        <Sidebar />
        <View style={{ flex: 1 }}>
          <Current key={route.key} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Current key={route.key} />
      </View>
      {inShell ? <BottomNav /> : null}
    </View>
  );
}

export default function App() {
  const [loaded, error] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <Background />
        {loaded || error ? (
          <AppStateProvider>
            <NavigationProvider>
              <ToastProvider>
                <Router />
              </ToastProvider>
            </NavigationProvider>
          </AppStateProvider>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  row: { flex: 1, flexDirection: 'row' },
});
