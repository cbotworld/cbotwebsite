import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { CombisScreen } from "./src/screens/CombisScreen";
import { StandingsScreen } from "./src/screens/StandingsScreen";
import { VideosScreen } from "./src/screens/VideosScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { LiveScreen } from "./src/screens/LiveScreen";
import { UpdateAppModal } from "./src/components/UpdateAppModal";
import { MainTabParamList, RootStackParamList } from "./src/navigation/types";
import { unlockAppOrientation } from "./src/utils/optionalScreenOrientation";
import { fetchAppVersion, restoreSession } from "./src/api/website";

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

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
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
          tabBarLabel: ({ color }) => <TabLabel label="PROFILE" color={color} />,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size || 22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [storeUpdate, setStoreUpdate] = useState<{
    currentVersion: string;
    latestVersion: string;
    storeUrl: string;
  } | null>(null);

  useEffect(() => {
    void unlockAppOrientation();
    void (async () => {
      await restoreSession();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (Platform.OS !== "android") return;
    if (Constants.appOwnership === "expo") return;

    const currentVersion =
      Constants.nativeAppVersion || Constants.expoConfig?.version || "";
    if (!currentVersion) return;

    void fetchAppVersion(currentVersion)
      .then((res) => {
        if (res.updateAvailable && res.latestVersion) {
          setStoreUpdate({
            currentVersion,
            latestVersion: res.latestVersion,
            storeUrl: res.storeUrl,
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
        storeUrl={storeUpdate?.storeUrl || "https://play.google.com/store/apps/details?id=com.cbotworld"}
        onLater={() => setStoreUpdate(null)}
      />
    </SafeAreaProvider>
  );
}
