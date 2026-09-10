import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View, Image } from "react-native";
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
import { NotificationsModal } from "./src/components/NotificationsModal";
import { MainTabParamList, RootStackParamList } from "./src/navigation/types";
import { lockAppOrientation } from "./src/utils/optionalScreenOrientation";
import { fetchAppVersion, restoreSession } from "./src/api/website";
import { registerForPushNotificationsAsync, initNotificationListeners } from "./src/utils/notifications";
import { getUnreadCount, addNotificationChangeListener } from "./src/utils/notificationStorage";

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

const appLogo = require('./assets/logo.png');

function CustomHeaderTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image
        source={appLogo}
        style={{ width: 26, height: 26, borderRadius: 6 }}
      />
      <Text style={{ color: '#f59e0b', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>
        {title}
      </Text>
    </View>
  );
}

function MainTabs() {
  const [reportVisible, setReportVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    void getUnreadCount().then(setUnreadCount);
    const unsubscribe = addNotificationChangeListener(() => {
      void getUnreadCount().then(setUnreadCount);
    });
    return unsubscribe;
  }, []);

  const HeaderRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 14 }}>
      {/* Bell Icon for Push Notifications */}
      <Pressable
        style={({ pressed }) => ({
          width: 33,
          height: 33,
          borderRadius: 10,
          backgroundColor: pressed ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.12)',
          borderColor: unreadCount > 0 ? '#f59e0b' : 'rgba(245, 158, 11, 0.35)',
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
        })}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => setNotificationsVisible(true)}
      >
        <Ionicons
          name={unreadCount > 0 ? "notifications" : "notifications-outline"}
          size={16}
          color="#f59e0b"
        />
        {unreadCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: '#ef4444',
              borderRadius: 8,
              minWidth: 16,
              height: 16,
              paddingHorizontal: 3,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: '#1c0205',
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '900' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* Report Button */}
      <Pressable
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: pressed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.18)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 5.5,
        })}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => setReportVisible(true)}
      >
        <Ionicons name="flag" size={13} color="#f87171" />
        <Text style={{ color: '#f87171', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 }}>REPORT</Text>
      </Pressable>
    </View>
  );

  return (
    <>
      <ReportIssueModal visible={reportVisible} onClose={() => setReportVisible(false)} />
      <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#1c0205' },
          headerTitle: ({ children }) => <CustomHeaderTitle title={typeof children === 'string' ? children : 'CBOT'} />,
          headerTitleAlign: 'left',
          headerShadowVisible: false,
          headerRight: () => <HeaderRight />,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: "#f59e0b",
          tabBarInactiveTintColor: "#a37075",
          tabBarStyle: {
            backgroundColor: "#1c0205",
            borderTopColor: "#35080c",
            borderTopWidth: 1,
            height: 56 + bottom,
            paddingBottom: bottom,
            paddingTop: 8,
          },
          sceneStyle: { backgroundColor: '#020617' },
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
    void lockAppOrientation("portrait");
    void (async () => {
      await restoreSession();
      setReady(true);
      initNotificationListeners();
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
    return <View style={{ flex: 1, backgroundColor: "#1c0205" }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="Main"
          screenOptions={{
            headerStyle: { backgroundColor: "#2b0408" },
            headerTintColor: "#f8fafc",
            contentStyle: { backgroundColor: "#1c0205" },
            orientation: "portrait",
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false, orientation: "portrait" }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false, orientation: "portrait" }} />
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false, orientation: "portrait" }} />
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
