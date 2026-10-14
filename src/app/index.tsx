import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer } from "expo-audio";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import MapPreviewNative from "../MapPreview.native";
import MapPreviewWeb from "../MapPreview.web";

const MapPreview = Platform.OS === "web" ? MapPreviewWeb : MapPreviewNative;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type LocationData = {
  address: string;
  latitude: number;
  longitude: number;
};

type Task = {
  id: string;
  title: string;
  completed: boolean;
  location: LocationData | null;
};

type Place = {
  properties: {
    osm_id?: number;
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
};

const STORAGE_KEY = "tasks";

export default function Index() {
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState<LocationData | null>(null);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locationError, setLocationError] = useState("");
  // Current device GPS location is independent from a task's selected address.
  const [gpsCoordinates, setGpsCoordinates] =
    useState<Location.LocationObjectCoords | null>(null);
  const [gpsAddress, setGpsAddress] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [locationPanelOpen, setLocationPanelOpen] = useState(false);

  const [notificationPermission, setNotificationPermission] = useState(false);

  const player = useAudioPlayer(require("../../assets/sounds/mysound.m4a"));

  // Load saved tasks
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);

        if (saved) {
          setTasks(JSON.parse(saved));
        }
      } catch (error) {
        console.error("Loading tasks failed:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadTasks();
  }, []);

  // Save tasks
  useEffect(() => {
    if (!isLoaded) return;

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)).catch((error) =>
      console.error("Saving tasks failed:", error),
    );
  }, [tasks, isLoaded]);

  // Set up notifications
  useEffect(() => {
    const setupNotifications = async () => {
      if (Platform.OS === "web") return;

      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("tasks", {
            name: "Task Notifications",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
          });
        }

        const current = await Notifications.getPermissionsAsync();

        let granted = current.status === "granted";

        if (!granted) {
          const requested = await Notifications.requestPermissionsAsync();

          granted = requested.status === "granted";
        }

        setNotificationPermission(granted);
      } catch (error) {
        console.error("Notification setup failed:", error);
      }
    };

    setupNotifications();
  }, []);

  // Search locations using Photon
  const searchLocation = async () => {
    const query = location.trim();

    if (!query) {
      setLocationError("Please enter a location.");
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    setSuggestions([]);
    setCoordinates(null);
    setLocationError("");

    try {
      const url =
        "https://photon.komoot.io/api/?" +
        new URLSearchParams({
          q: query,
          limit: "5",
        }).toString();

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Location search failed");
      }

      const result = await response.json();
      const places: Place[] = result.features ?? [];

      if (places.length === 0) {
        setLocationError("No matching place found.");
      } else {
        setSuggestions(places);
      }
    } catch (error) {
      console.error("Location search error:", error);
      setLocationError("Search failed. Check your internet and try again.");
    } finally {
      setSearching(false);
    }
  };

  // Build a readable address from the selected place
  const selectLocation = (place: Place) => {
    const p = place.properties;
    const [longitude, latitude] = place.geometry.coordinates;

    const address = [p.name, p.street, p.city, p.state, p.country]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .join(", ");

    setCoordinates({
      address: address || location,
      latitude,
      longitude,
    });

    setLocation(address || location);
    setSuggestions([]);
    setLocationError("");
    Keyboard.dismiss();
  };

  // Add task with location
  const addTask = async () => {
    const title = task.trim();

    if (!title) {
      Alert.alert("Missing task", "Please enter a task.");
      return;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title,
      completed: false,
      location: coordinates,
    };

    setTasks((previous) => [...previous, newTask]);

    setTask("");
    setLocation("");
    setCoordinates(null);
    setSuggestions([]);
    setLocationError("");

    // Play your custom sound inside the app
    try {
      player.seekTo(0);
      player.play();
    } catch (error) {
      console.error("Custom sound failed:", error);
    }

    // Play the device's default notification sound
    try {
      if (notificationPermission && Platform.OS !== "web") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "New Task Added!",
            body: `You added: ${title}`,

            ...(Platform.OS === "android" ? { channelId: "tasks" } : {}),
          },
          trigger: null,
        });
      }
    } catch (error) {
      console.error("Notification failed:", error);
    }
  };

  const toggleTask = (id: string) => {
    setTasks((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((previous) => previous.filter((item) => item.id !== id));
  };

  // Get current device GPS location
  
const getCurrentLocation = async () => {
  if (gpsLoading) return;

  setGpsLoading(true);
  setGpsError("");

  try {
  
    const servicesEnabled =
      await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      setGpsError(
        "Please turn ON your device location/GPS."
      );
      return;
    }

    const permission =
      await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      setGpsError(
        "Location permission denied. Allow location access in Settings."
      );
      return;
    }

    const result = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });

    setGpsCoordinates(result.coords);

    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      });

      if (places.length > 0) {
        const p = places[0];

        const address = [
          p.name,
          p.street,
          p.district,
          p.city,
          p.region,
          p.postalCode,
          p.country,
        ]
          .filter(Boolean)
          .filter(
            (value, index, array) =>
              array.indexOf(value) === index
          )
          .join(", ");

        setGpsAddress(address || "Address unavailable");
      } else {
        setGpsAddress("Address unavailable");
      }
    } catch (error) {
      console.log("Address lookup failed:", error);
      setGpsAddress("Address unavailable");
    }
  } catch (error) {
    console.error("GPS ERROR:", error);

    setGpsError(
      "Could not get GPS location. Check your emulator or device location settings."
    );
  } finally {
    setGpsLoading(false);
  }
};
  
  useEffect(() => {
    getCurrentLocation();
  }, []);

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>My To-Do List</Text>
      <Text style={styles.subtitle}>Stay organized and productive!</Text>

      {/* Device location side navigation */}
      <View style={styles.locationNav}>
        <Pressable
          accessibilityLabel="Toggle current location details"
          accessibilityRole="button"
          style={styles.locationRail}
          onPress={() => setLocationPanelOpen((open) => !open)}
        >
          <Text style={styles.locationRailIcon}>⌖</Text>
          <Text style={styles.locationRailText}>GPS</Text>
        </Pressable>

        {locationPanelOpen && (
          <View style={styles.locationPanel}>
            <View style={styles.locationPanelHeader}>
              <View>
                <Text style={styles.locationPanelTitle}>Current location</Text>
                <Text style={styles.locationPanelHint}>Device GPS details</Text>
              </View>
              <Pressable
                accessibilityLabel="Close current location details"
                onPress={() => setLocationPanelOpen(false)}
                style={styles.closeLocationButton}
              >
                <Text style={styles.closeLocationText}>×</Text>
              </Pressable>
            </View>

            {gpsLoading ? (
              <View style={styles.locationStatusRow}>
                <ActivityIndicator color="#0F766E" />
                <Text style={styles.locationStatus}>Updating location...</Text>
              </View>
            ) : gpsCoordinates ? (
              <View style={styles.locationDetails}>
                <Text style={styles.locationAddress}>
                  {gpsAddress || "Address unavailable"}
                </Text>
                <Text style={styles.locationCoordinate}>
                  Latitude {gpsCoordinates.latitude.toFixed(6)}
                </Text>
                <Text style={styles.locationCoordinate}>
                  Longitude {gpsCoordinates.longitude.toFixed(6)}
                </Text>
              </View>
            ) : (
              <Text style={styles.locationStatus}>
                {gpsError || "Location not available"}
              </Text>
            )}

            <Pressable
              style={styles.updateLocationButton}
              onPress={getCurrentLocation}
              disabled={gpsLoading}
            >
              <Text style={styles.updateLocationText}>
                {gpsLoading ? "Updating..." : "Update Location"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Task input */}
      <TextInput
        style={styles.input}
        placeholder="Enter a task..."
        placeholderTextColor="#888"
        value={task}
        onChangeText={setTask}
        onSubmitEditing={addTask}
        returnKeyType="done"
      />
      {/* Location search */}
      <Text style={styles.sectionTitle}>Add a location (optional)</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.locationInput}
          placeholder="Search city, address or place..."
          placeholderTextColor="#888"
          value={location}
          onChangeText={(value) => {
            setLocation(value);
            setCoordinates(null);
            setSuggestions([]);
            setLocationError("");
          }}
          onSubmitEditing={searchLocation}
          returnKeyType="search"
        />

        <Pressable
          style={styles.findButton}
          onPress={searchLocation}
          disabled={searching}
        >
          <Text style={styles.buttonText}>{searching ? "..." : "Find"}</Text>
        </Pressable>
      </View>
      {searching && (
        <ActivityIndicator style={styles.spinner} color="#7C3AED" />
      )}
      {!!locationError && <Text style={styles.errorText}>{locationError}</Text>}
      {/* Search results */}
      {suggestions.map((place, index) => {
        const p = place.properties;

        const label = [p.name, p.street, p.city, p.state, p.country]
          .filter(Boolean)
          .filter((value, i, array) => array.indexOf(value) === i)
          .join(", ");

        return (
          <Pressable
            key={`${p.osm_id ?? "place"}-${index}`}
            style={styles.suggestion}
            onPress={() => selectLocation(place)}
          >
            <Text style={styles.suggestionText}>
              📍 {label || "Unnamed place"}
            </Text>
          </Pressable>
        );
      })}
      {/* Selected location and map */}
      {coordinates && (
        <View style={styles.mapCard}>
          <Text style={styles.selectedTitle}>Selected location</Text>

          <Text style={styles.addressText}>{coordinates.address}</Text>

          <MapPreview
            latitude={coordinates.latitude}
            longitude={coordinates.longitude}
            title={coordinates.address}
          />

          <Text style={styles.coordinatesText}>
            Latitude: {coordinates.latitude.toFixed(6)}
          </Text>

          <Text style={styles.coordinatesText}>
            Longitude: {coordinates.longitude.toFixed(6)}
          </Text>

          <Pressable
            style={styles.removeButton}
            onPress={() => {
              setCoordinates(null);
              setLocation("");
            }}
          >
            <Text style={styles.removeText}>Remove location</Text>
          </Pressable>
        </View>
      )}
      {/* Add task */}
      <Pressable style={styles.addButton} onPress={addTask}>
        <Text style={styles.buttonText}>Add Task</Text>
      </Pressable>

      <Text style={styles.taskCount}>Total tasks: {tasks.length}</Text>

      {/* Task list */}
      {tasks.length === 0 ? (
        <Text style={styles.emptyText}>No tasks yet. Add your first task!</Text>
      ) : (
        tasks.map((item) => (
          <View key={item.id} style={styles.taskItem}>
            <Pressable
              style={styles.taskContent}
              onPress={() => toggleTask(item.id)}
            >
              <Text style={styles.checkbox}>{item.completed ? "☑" : "☐"}</Text>

              <View style={styles.taskDetails}>
                <Text
                  style={[
                    styles.taskText,
                    item.completed && styles.completedTask,
                  ]}
                >
                  {item.title}
                </Text>

                {item.location && (
                  <Text style={styles.taskLocation}>
                    📍 {item.location.address}
                  </Text>
                )}
              </View>
            </Pressable>

            <Pressable
              style={styles.deleteButton}
              onPress={() => deleteTask(item.id)}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F3FF",
  },

  content: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },

  heading: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#5B21B6",
  },

  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
    marginBottom: 22,
  },

  locationNav: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 18,
    minHeight: 58,
  },

  locationRail: {
    width: 52,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },

  locationRailIcon: {
    color: "#EDE9FE",
    fontSize: 23,
    lineHeight: 25,
  },

  locationRailText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  locationPanel: {
    flex: 1,
    marginLeft: 8,
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  locationPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  locationPanelTitle: {
    color: "#5B21B6",
    fontSize: 15,
    fontWeight: "800",
  },

  locationPanelHint: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },

  closeLocationButton: {
    paddingHorizontal: 4,
    marginTop: -6,
  },

  closeLocationText: {
    color: "#64748B",
    fontSize: 24,
    lineHeight: 24,
  },

  locationDetails: {
    marginTop: 11,
    gap: 4,
  },

  locationAddress: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  locationCoordinate: {
    color: "#64748B",
    fontSize: 12,
  },

  locationStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },

  locationStatus: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 10,
  },

  updateLocationButton: {
    alignSelf: "flex-start",
    backgroundColor: "#EDE9FE",
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  updateLocationText: {
    color: "#6D28D9",
    fontSize: 12,
    fontWeight: "800",
  },

  input: {
    minHeight: 50,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#444",
    marginTop: 20,
    marginBottom: 8,
  },

  searchRow: {
    flexDirection: "row",
    gap: 8,
  },

  locationInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },

  findButton: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },

  addButton: {
    backgroundColor: "#7C3AED",
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginTop: 15,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },

  spinner: {
    marginTop: 12,
  },

  errorText: {
    color: "#DC2626",
    marginTop: 8,
  },

  suggestion: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },

  suggestionText: {
    color: "#222",
    fontSize: 14,
  },

  mapCard: {
    marginTop: 15,
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
  },

  selectedTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#5B21B6",
    marginBottom: 6,
  },

  addressText: {
    fontSize: 13,
    color: "#555",
    marginBottom: 10,
  },

  coordinatesText: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },

  removeButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 5,
  },

  removeText: {
    color: "#DC2626",
    fontWeight: "600",
  },

  taskCount: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 25,
    marginBottom: 10,
    color: "#444",
  },

  emptyText: {
    textAlign: "center",
    marginTop: 25,
    color: "#888",
    fontSize: 16,
  },

  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },

  taskContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },

  taskDetails: {
    flex: 1,
  },

  checkbox: {
    fontSize: 24,
    marginRight: 10,
    color: "#7C3AED",
  },

  taskText: {
    fontSize: 16,
    color: "#222",
  },

  completedTask: {
    textDecorationLine: "line-through",
    color: "#999",
  },

  taskLocation: {
    fontSize: 12,
    color: "#6D28D9",
    marginTop: 5,
  },

  deleteButton: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },

  deleteText: {
    color: "#DC2626",
    fontWeight: "600",
  },
});
