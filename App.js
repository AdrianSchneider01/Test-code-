import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const activityDatabase = [
  {
    mood: 'happy',
    vibe: 'active',
    ideas: [
      'Go for a run in the park',
      'Try a dance class',
      'Play a sport with friends',
      'Explore a new hiking trail',
    ],
  },
  {
    mood: 'happy',
    vibe: 'chill',
    ideas: [
      'Have a picnic outside',
      'Watch your favorite movie',
      'Cook a special meal',
      'Read a feel-good book',
    ],
  },
  {
    mood: 'happy',
    vibe: 'social',
    ideas: [
      'Throw a small dinner party',
      'Call someone you miss',
      'Explore a farmers market with friends',
      'Join a community event',
    ],
  },
  {
    mood: 'happy',
    vibe: 'creative',
    ideas: [
      'Paint or draw something joyful',
      'Write in your journal',
      'Try a new craft project',
      'Make a photo collage',
    ],
  },
  {
    mood: 'sad',
    vibe: 'chill',
    ideas: [
      'Watch a comforting movie',
      'Make a warm cup of tea and relax',
      'Take a long bath',
      'Listen to soothing music',
    ],
  },
  {
    mood: 'sad',
    vibe: 'active',
    ideas: [
      'Take a slow walk in nature',
      'Do some gentle yoga',
      'Swim some laps',
      'Go for an easy bike ride',
    ],
  },
  {
    mood: 'sad',
    vibe: 'social',
    ideas: [
      'Reach out to a close friend',
      'Visit a family member',
      'Volunteer somewhere local',
      'Join an online support community',
    ],
  },
  {
    mood: 'bored',
    vibe: 'active',
    ideas: [
      'Try a new sport or fitness class',
      'Go for a run somewhere new',
      'Do a home workout challenge',
      'Take a long bike ride',
    ],
  },
  {
    mood: 'bored',
    vibe: 'creative',
    ideas: [
      'Learn to draw or paint',
      'Start a DIY home project',
      'Write a short story',
      'Pick up a new instrument',
    ],
  },
  {
    mood: 'bored',
    vibe: 'productive',
    ideas: [
      'Organize a cluttered space',
      'Learn a new skill online',
      'Plan your week ahead',
      'Start that project you have been putting off',
    ],
  },
  {
    mood: 'anxious',
    vibe: 'chill',
    ideas: [
      'Practice deep breathing exercises',
      'Try a guided meditation',
      'Do gentle stretches',
      'Write your worries in a journal',
    ],
  },
  {
    mood: 'anxious',
    vibe: 'active',
    ideas: [
      'Go for a brisk walk',
      'Do a yoga session',
      'Try boxing or kickboxing',
      'Go for a swim',
    ],
  },
  {
    mood: 'tired',
    vibe: 'chill',
    ideas: [
      'Take a short nap',
      'Watch a light TV show',
      'Read a few chapters of a book',
      'Listen to a podcast in bed',
    ],
  },
  {
    mood: 'tired',
    vibe: 'creative',
    ideas: [
      'Doodle or color in a coloring book',
      'Listen to music and daydream',
      'Browse design inspiration online',
      'Write a short poem',
    ],
  },
  {
    mood: 'energetic',
    vibe: 'active',
    ideas: [
      'Hit the gym hard',
      'Play a competitive sport',
      'Go rock climbing',
      'Do a HIIT workout',
    ],
  },
  {
    mood: 'energetic',
    vibe: 'social',
    ideas: [
      'Organize a group outing',
      'Host a game night',
      'Go dancing with friends',
      'Join a local sports league',
    ],
  },
  {
    mood: 'stressed',
    vibe: 'chill',
    ideas: [
      'Practice mindfulness meditation',
      'Take a long hot shower',
      'Do some light reading',
      'Listen to calming music',
    ],
  },
  {
    mood: 'stressed',
    vibe: 'active',
    ideas: [
      'Go for a run to clear your head',
      'Try a kickboxing class',
      'Do a high-intensity workout',
      'Take a swim',
    ],
  },
  {
    mood: 'excited',
    vibe: 'social',
    ideas: [
      'Plan a spontaneous road trip',
      'Invite friends for a night out',
      'Try a new restaurant together',
      'Organize a group activity',
    ],
  },
  {
    mood: 'excited',
    vibe: 'creative',
    ideas: [
      'Start a passion project',
      'Record a video or podcast',
      'Redecorate a room',
      'Create something to share online',
    ],
  },
  {
    mood: 'calm',
    vibe: 'chill',
    ideas: [
      'Enjoy a quiet reading session',
      'Do a jigsaw puzzle',
      'Garden or tend to houseplants',
      'Practice journaling',
    ],
  },
  {
    mood: 'calm',
    vibe: 'creative',
    ideas: [
      'Write poetry or prose',
      'Sketch or paint landscapes',
      'Learn calligraphy',
      'Compose a simple melody',
    ],
  },
];

const fallbackIdeas = [
  'Go for a walk',
  'Listen to a podcast',
  'Learn a new skill',
  'Call a friend',
  'Try a new recipe',
];

export default function App() {
  const [age, setAge] = useState('');
  const [mood, setMood] = useState('');
  const [vibe, setVibe] = useState('');
  const [ideas, setIdeas] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isGeneric, setIsGeneric] = useState(false);

  function handleGiveIdeas() {
    const normalizedMood = mood.trim().toLowerCase();
    const normalizedVibe = vibe.trim().toLowerCase();

    const match = activityDatabase.find(
      (entry) =>
        entry.mood === normalizedMood && entry.vibe === normalizedVibe
    );

    if (match) {
      setIdeas(match.ideas);
      setIsGeneric(false);
    } else {
      setIdeas(fallbackIdeas);
      setIsGeneric(true);
    }

    setHasSearched(true);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>What Should I Do?</Text>
        <Text style={styles.subtitle}>
          Tell us about yourself and we'll find the perfect activity.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Your Age</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 28"
            placeholderTextColor="#9ca3af"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            maxLength={3}
          />

          <Text style={styles.label}>Current Mood</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. happy, sad, bored, anxious..."
            placeholderTextColor="#9ca3af"
            value={mood}
            onChangeText={setMood}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Desired Vibe</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. active, chill, social, creative..."
            placeholderTextColor="#9ca3af"
            value={vibe}
            onChangeText={setVibe}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleGiveIdeas}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Give Me Ideas</Text>
          </TouchableOpacity>
        </View>

        {hasSearched && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsHeader}>
              {isGeneric
                ? 'Here are some ideas to get you started:'
                : `Ideas for when you're feeling ${mood} and want something ${vibe}:`}
            </Text>
            {ideas.map((idea, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.cardIndex}>
                  <Text style={styles.cardIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.cardText}>{idea}</Text>
              </View>
            ))}
            {isGeneric && (
              <Text style={styles.noMatchNote}>
                No exact match found for "{mood}" + "{vibe}". Try moods like happy, sad, bored, anxious, tired, energetic, stressed, excited, or calm — and vibes like active, chill, social, creative, or productive.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 32,
    lineHeight: 22,
  },
  form: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  resultsSection: {
    marginTop: 36,
  },
  resultsHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  cardIndexText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  cardText: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
    flex: 1,
  },
  noMatchNote: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
