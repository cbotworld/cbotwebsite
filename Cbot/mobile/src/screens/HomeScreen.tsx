import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { getSchedule, type ScheduleDay } from "../api/client";
import { RootStackParamList } from "../navigation/types";
import { useDeviceOrientation } from "../hooks/useDeviceOrientation";
import { PoweredByFooter } from "../components/PoweredByFooter";

const logo = require("../../assets/logo.png");

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<ScheduleDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const isLandscape = useDeviceOrientation(width, height) === "landscape";

  useEffect(() => {
    let cancelled = false;
    getSchedule()
      .then((res) => {
        if (cancelled) return;
        const list = res.days || [];
        setDays(list);
        const live = list.find((d) => d.status === "live") || list.find((d) => d.dayNumber === res.liveDay);
        if (live) setSelectedDay(live);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load tournament schedule. Check your connection.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onContinue = () => {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!selectedDay) {
      setError("Select today's scheduled day.");
      return;
    }
    if (selectedDay.status !== "live") {
      setError(
        selectedDay.status === "completed"
          ? `${selectedDay.label} is closed.`
          : `${selectedDay.label} is not open yet.`,
      );
      return;
    }
    setError(null);
    navigation.navigate("Live", { name: name.trim(), day: selectedDay.label });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.card, isLandscape ? styles.cardLandscape : styles.cardPortrait]}>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="Carrom BALU Online Tournament" />
        <View style={styles.formSection}>
        <Text style={styles.subtitle}>Enter your name, pick the live match day, then go live on YouTube.</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor="#888"
          style={styles.input}
        />

        <Text style={styles.label}>Match day</Text>
        <View style={styles.dayWrap}>
          {days.map((d) => {
            const selected = selectedDay?.dayNumber === d.dayNumber;
            return (
              <Pressable
                key={d.dayNumber}
                onPress={() => {
                  setSelectedDay(d);
                  setError(null);
                }}
                style={[
                  styles.dayChip,
                  selected && styles.dayChipSelected,
                  d.status === "live" && !selected && styles.dayChipLive,
                  d.status === "completed" && styles.dayChipDone,
                ]}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    selected && styles.dayChipTextSelected,
                    d.status === "live" && !selected && styles.dayChipTextLive,
                  ]}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {selectedDay ? (
          <Text style={styles.dayHint}>
            {selectedDay.status === "live"
              ? `Live now · ${selectedDay.timeRange}`
              : selectedDay.status === "completed"
              ? `Closed · ${selectedDay.timeRange}`
              : `Opens later · ${selectedDay.timeRange}`}
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={onContinue}>
          <Text style={styles.buttonText}>Start Live Session</Text>
        </Pressable>
        </View>
      </View>
      <PoweredByFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    gap: 24,
    width: "100%",
    maxWidth: 920,
  },
  cardLandscape: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardPortrait: {
    flexDirection: "column",
    alignItems: "center",
    maxWidth: 480,
  },
  formSection: {
    flex: 1,
    gap: 8,
    minWidth: 280,
    alignSelf: "stretch",
  },
  logo: {
    width: 180,
    height: 180,
  },
  subtitle: {
    color: "#94a3b8",
    marginBottom: 4,
    textAlign: "center",
  },
  label: {
    color: "#cbd5e1",
    marginTop: 8,
    fontWeight: "600",
    alignSelf: "stretch",
  },
  input: {
    alignSelf: "stretch",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  dayWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
  },
  dayChipSelected: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  dayChipLive: {
    borderColor: "#34d399",
  },
  dayChipDone: {
    opacity: 0.45,
  },
  dayChipText: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
  },
  dayChipTextSelected: {
    color: "#fff",
  },
  dayChipTextLive: {
    color: "#34d399",
  },
  dayHint: {
    color: "#94a3b8",
    fontSize: 12,
  },
  button: {
    alignSelf: "stretch",
    marginTop: 16,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  error: {
    color: "#fca5a5",
    marginTop: 8,
  },
});
