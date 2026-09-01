import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Constants from "expo-constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { CombisScreen } from "./src/screens/CombisScreen";
import { StandingsScreen } from "./src/screens/StandingsScreen";
import { VideosScreen } from "./src/screens/VideosScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { LiveScreen } from "./src/screens/LiveScreen";
import { UpdateAppModal } from "./src/components/UpdateAppModal";
import { ReportIssueModal } from "./src/components/ReportIssueModal";
import { MainTabParamList, RootStackParamList } from "./src/navigation/types";
import { unlockAppOrientation } from "./src/utils/optionalScreenOrientation";
import { fetchAppVersion, restoreSession } from "./src/api/website";
import { registerForPushNotificationsAsync } from "./src/utils/notifications";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const parseParam = (value: string) => decodeURIComponent(value);

const linking = {
  prefixes: [Linking.createURL("/"), "cbot://"],
  config: {
    screens: {
      Login: "login",
      Main: {
        path: "",
        screens: {
          Dashboard: "dashboard",
          Combis: "combis",
          Standings: "standings",
          Videos: "videos",
          Profile: "profile",
        },
      },
      Live: {
        path: "live",
        parse: {
          name: parseParam,
          day: parseParam,
          teamName: parseParam,
          opponentName: parseParam,
          stage: parseParam,
          editionTitle: parseParam,
          timeRange: parseParam,
          endIso: parseParam,
        },
      },
    },
  },
};

function TabLabel({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 9, fontWeight: "800", letterSpacing: 0.4 }}>{label}</Text>;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  const [reportVisible, setReportVisible] = useState(false);

  const ReportButton = () => (
    <Pressable
      onPress={() => setReportVisible(true)}
      hitSlop={10}
      style={{
        marginRight: 14,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <Text style={{ fontSize: 13 }}>🚩</Text>
      <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>REPORT</Text>
    </Pressable>
  );

  return (
    <>
      <ReportIssueModal visible={reportVisible} onClose={() => setReportVisible(false)} />
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#0f172a' },
          headerTitleStyle: { color: '#f59e0b', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
          headerTitleAlign: 'left',
          headerShadowVisible: false,
          headerRight: () => <ReportButton />,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: "#f59e0b",
          tabBarInactiveTintColor: "#64748b",
          tabBarStyle: {
            backgroundColor: "#020617",
            borderTopColor: "#1e293b",
            borderTopWidth: 1,
            height: 56 + bottom,
            paddingBottom: bottom,
            paddingTop: 8,
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            title: 'CBOT',
            tabBarLabel: ({ color }) => <TabLabel label="MATCHES" color={color} />,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? "trophy" : "trophy-outline"} size={size || 22} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Combis"
          component={CombisScreen}
          options={{
            title: 'COMBIS',
            tabBarLabel: ({ color }) => <TabLabel label="COMBIS" color={color} />,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? "grid" : "grid-outline"} size={size || 22} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Standings"
          component={StandingsScreen}
          options={{
            title: 'STANDINGS',
            tabBarLabel: ({ color }) => <TabLabel label="STAND" color={color} />,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? "podium" : "podium-outline"} size={size || 22} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Videos"
          component={VideosScreen}
          options={{
            title: 'VIDEOS',
            tabBarLabel: ({ color }) => <TabLabel label="VIDEOS" color={color} />,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? "play-circle" : "play-circle-outline"} size={size || 22} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'PROFILE',
            tabBarLabel: ({ color }) => <TabLabel label="PROFILE" color={color} />,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size || 22} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [storeUpdate, setStoreUpdate] = useState<{
    currentVersion: string;
    latestVersion: string;
    storeUrl: string;
    platform: string;
  } | null>(null);

  useEffect(() => {
    void unlockAppOrientation();
    void (async () => {
      await restoreSession();
      setReady(true);
      void registerForPushNotificationsAsync();
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (Constants.appOwnership === "expo") return;

    const currentVersion =
      Constants.nativeAppVersion || Constants.expoConfig?.version || "1.3";
    const currentBuild =
      Constants.nativeBuildVersion || "30";

    void fetchAppVersion({
      currentVersion,
      currentBuild,
      platform: Platform.OS,
    })
      .then((res) => {
        if (res.updateAvailable && res.latestVersion) {
          const formattedCurrent = res.currentBuild
            ? `v${res.currentVersion || currentVersion} (build ${res.currentBuild})`
            : `v${res.currentVersion || currentVersion}`;
          const formattedLatest = res.latestBuild
            ? `v${res.latestVersion} (build ${res.latestBuild})`
            : `v${res.latestVersion}`;
          setStoreUpdate({
            currentVersion: formattedCurrent,
            latestVersion: formattedLatest,
            storeUrl: res.storeUrl,
            platform: res.platform || Platform.OS,
          });
        }
      })
      .catch(() => undefined);
  }, [ready]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: "#020617" }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="Main"
          screenOptions={{
            headerStyle: { backgroundColor: "#0f172a" },
            headerTintColor: "#f8fafc",
            contentStyle: { backgroundColor: "#0f172a" },
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="Live"
            component={LiveScreen}
            options={{ headerShown: false, orientation: "landscape" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <UpdateAppModal
        visible={Boolean(storeUpdate)}
        currentVersion={storeUpdate?.currentVersion || ""}
        latestVersion={storeUpdate?.latestVersion || ""}
        storeUrl={storeUpdate?.storeUrl || (Platform.OS === "ios" ? "https://apps.apple.com/app/id6742533036" : "https://play.google.com/store/apps/details?id=com.cbotworld")}
        platform={storeUpdate?.platform || Platform.OS}
        onLater={() => setStoreUpdate(null)}
      />
    </SafeAreaProvider>
  );
}
