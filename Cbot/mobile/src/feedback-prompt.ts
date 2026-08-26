import AsyncStorage from '@react-native-async-storage/async-storage';

const RATED_KEY = 'cbot.playStoreRated';
const FEEDBACK_KEY = 'cbot.appFeedbackGiven';

export async function getFeedbackPromptState() {
  const [rated, feedback] = await Promise.all([
    AsyncStorage.getItem(RATED_KEY),
    AsyncStorage.getItem(FEEDBACK_KEY),
  ]);
  return {
    rated: rated === '1',
    feedbackGiven: feedback === '1',
  };
}

export async function markPlayStoreRated() {
  await AsyncStorage.setItem(RATED_KEY, '1');
}

export async function markAppFeedbackGiven() {
  await AsyncStorage.setItem(FEEDBACK_KEY, '1');
}
