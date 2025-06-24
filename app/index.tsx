import React, { useState, useEffect } from "react";
import { View, StyleSheet, useColorScheme, Animated } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Text,
  ActivityIndicator,
  MD3LightTheme,
  MD3DarkTheme,
  PaperProvider,
} from "react-native-paper";
import { useRouter } from "expo-router";
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

// Screens
import LoadingScreen from "./components/LoadingScreen";
import ModernAuthScreen from "./components/ModernAuthScreen";
import StudentCarpoolSystem from "./components/StudentCarpoolSystem";
import BusBookingSystem from "./components/BusBookingSystem";
import UserProfileSafety from "./components/UserProfileSafety";

// ✅ Add these missing imports at the top
import { TouchableOpacity, ScrollView, Alert } from "react-native";
import { IconButton } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

import { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import Auth from "./components/ModernAuthScreen";

// Theme
const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#000000",
    background: "#FFFFFF",
    onBackground: "#000000",
    surface: "#FFFFFF",
    onSurface: "#000000",
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#FFFFFF",
    background: "#000000",
    onBackground: "#FFFFFF",
    surface: "#000000",
    onSurface: "#FFFFFF",
  },
};

const useAuth = (session?: Session) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (session?.user) {
      const sessionUser = session.user;
      const userFromSession = {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.user_metadata.full_name || sessionUser.email,
        role: sessionUser.user_metadata.role || "passenger",
        branch: sessionUser.user_metadata.branch,
        year: sessionUser.user_metadata.year,
        rating: sessionUser.user_metadata.rating || 4.5,
        profilePicture: sessionUser.user_metadata.avatar_url,
        phone: sessionUser.user_metadata.phone,
        ridesCompleted: sessionUser.user_metadata.ridesCompleted || 0,
      };
      setUser(userFromSession);
    }
    setLoading(false);
    const timer = setTimeout(() => setIsInitialLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [session]);

  const login = (
    email: string,
    password: string,
    role: "driver" | "passenger" | "external_driver"
  ) => {
    const userData = {
      id: email,
      email,
      role,
      name: role === "driver" ? "Driver" : "Student",
    };
    setUser(userData);
    return Promise.resolve();
  };

  const logout = () => {
    setUser(null);
    return Promise.resolve();
  };

  return { user, loading, isInitialLoading, login, logout };
};

const AppContent = ({ session }: { session: Session }) => {
  const { user, loading, isInitialLoading, login, logout } = useAuth(session);
  const [index, setIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [sidebarAnimation] = useState(new Animated.Value(-400));
  const colorScheme = useColorScheme();
  const [busBookings, setBusBookings] = useState<any[]>([]);
  const [bookedSeats, setBookedSeats] = useState<{ [busId: string]: string[] }>(
    {}
  );
  const router = useRouter();
  const [sectionLoading, setSectionLoading] = useState(false);

  const themeTransition = useSharedValue(0);

  useEffect(() => {
    setIsDarkMode(false); // default theme
  }, [colorScheme]);

  useEffect(() => {
    themeTransition.value = withTiming(isDarkMode ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [isDarkMode]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    backgroundColor: isDarkMode ? "#000000" : "#FFFFFF",
  }));

  const [routes] = useState([
    {
      key: "carpool",
      title: "Carpool",
      focusedIcon: "car",
      unfocusedIcon: "car-outline",
    },
    {
      key: "bus",
      title: "Bus",
      focusedIcon: "bus",
      unfocusedIcon: "bus",
    },
    {
      key: "profile",
      title: "Profile",
      focusedIcon: "account",
      unfocusedIcon: "account-outline",
    },
  ]);

  const toggleSidebar = () => {
    const toValue = sidebarVisible ? -400 : 0;
    setSidebarVisible(!sidebarVisible);
    Animated.spring(sidebarAnimation, {
      toValue,
      useNativeDriver: true,
      damping: 18,
      stiffness: 120,
    }).start();
  };

  if (isInitialLoading) {
    return <LoadingScreen isDarkMode={isDarkMode} />;
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Animated.View
          style={[styles.loadingContainer, animatedContainerStyle]}
        >
          <ActivityIndicator
            size="large"
            animating={true}
            color={isDarkMode ? "#FFFFFF" : "#000000"}
          />
          <Text
            variant="bodyLarge"
            style={{ marginTop: 16, color: isDarkMode ? "#FFFFFF" : "#000000" }}
          >
            Loading LNMIIT Carpool...
          </Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return <ModernAuthScreen onAuthenticated={login} isDarkMode={isDarkMode} />;
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar
        style="dark"
        backgroundColor="transparent"
        translucent={true}
      />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Animated.View style={[styles.container, animatedContainerStyle]}>
          {/* Header Removed */}

          {/* Content with Custom Bottom Navigation */}
          <View style={styles.content}>
            {/* Main Content */}
            <View style={styles.sceneContainer}>
              {sectionLoading && (
                <View
                  style={[
                    styles.sectionLoadingOverlay,
                    {
                      backgroundColor: isDarkMode
                        ? "rgba(0,0,0,0.8)"
                        : "rgba(255,255,255,0.8)",
                    },
                  ]}
                >
                  <ActivityIndicator
                    size="large"
                    color={isDarkMode ? "#FFFFFF" : "#000000"}
                  />
                  <Text
                    style={[
                      styles.sectionLoadingText,
                      {
                        color: isDarkMode ? "#FFFFFF" : "#000000",
                      },
                    ]}
                  >
                    Loading...
                  </Text>
                </View>
              )}

              {index === 0 && (
                <StudentCarpoolSystem
                  isDarkMode={isDarkMode}
                  currentUser={{
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    branch: user.branch,
                    year: user.year,
                    rating: user.rating,
                    photo:
                      user.profilePicture ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
                  }}
                  onCreateRide={() => {
                    console.log("Create ride from StudentCarpool");
                    // Navigate to create ride functionality
                  }}
                  onJoinRide={(rideId) => {
                    console.log("Join ride:", rideId);
                    // Handle ride join logic
                  }}
                  onShowBusBooking={() => {
                    setIndex(1); // Switch to bus booking tab
                  }}
                  onToggleSidebar={toggleSidebar}
                />
              )}
              {index === 1 && (
                <BusBookingSystem
                  isDarkMode={isDarkMode}
                  currentUser={{
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    branch: user.branch,
                    year: user.year,
                    rating: user.rating,
                    photo:
                      user.profilePicture ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
                  }}
                  busBookings={busBookings}
                  onUpdateBookings={setBusBookings}
                  bookedSeats={bookedSeats}
                  onUpdateBookedSeats={setBookedSeats}
                  onToggleSidebar={toggleSidebar}
                  sidebarVisible={sidebarVisible}
                />
              )}
              {index === 2 &&
                (user.role === "external_driver" ? (
                  <UserProfileSafety
                    user={user}
                    busBookings={busBookings}
                    onLogout={logout}
                    isDarkMode={isDarkMode}
                  />
                ) : (
                  <UserProfileSafety
                    user={user}
                    busBookings={busBookings}
                    onLogout={logout}
                    isDarkMode={isDarkMode}
                  />
                ))}
            </View>

            {/* Custom Bottom Navigation */}
            <View
              style={[
                styles.bottomNavContainer,
                {
                  backgroundColor: isDarkMode ? "#000000" : "#FFFFFF",
                  borderTopColor: isDarkMode ? "#333333" : "#E0E0E0",
                  borderTopWidth: 1,
                  zIndex: 1, // Lower z-index so sidebar can cover it
                  elevation: 1, // Lower elevation for Android
                },
              ]}
            >
              {routes.map((route, routeIndex) => {
                const isActive = index === routeIndex;
                const iconName = isActive
                  ? route.focusedIcon
                  : route.unfocusedIcon;

                return (
                  <TouchableOpacity
                    key={route.key}
                    style={[styles.tabItem, isActive && styles.activeTabItem]}
                    onPress={() => {
                      if (index !== routeIndex) {
                        setSectionLoading(true);
                        setTimeout(() => {
                          setIndex(routeIndex);
                          setSectionLoading(false);
                        }, 300);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.tabIconContainer,
                        isActive && {
                          backgroundColor: isDarkMode
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                        },
                      ]}
                    >
                      <IconButton
                        icon={iconName}
                        size={22}
                        iconColor={
                          isActive
                            ? isDarkMode
                              ? "#FFFFFF"
                              : "#000000"
                            : isDarkMode
                            ? "#666666"
                            : "#999999"
                        }
                        style={styles.tabButton}
                      />
                    </View>
                    <Text
                      style={[
                        styles.tabLabel,
                        {
                          color: isActive
                            ? isDarkMode
                              ? "#FFFFFF"
                              : "#000000"
                            : isDarkMode
                            ? "#666666"
                            : "#999999",
                          fontWeight: isActive ? "700" : "500",
                        },
                      ]}
                    >
                      {route.title}
                    </Text>
                    {/* Underline removed */}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Global Sidebar - positioned at app level to cover everything including bottom nav */}
          {sidebarVisible && (
            <>
              {/* Sidebar */}
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "85%",
                    height: "100%",
                    maxWidth: 380,
                    zIndex: 10000, // Highest possible z-index
                    elevation: 50, // Maximum elevation for Android
                    shadowColor: "#000",
                    shadowOffset: { width: 4, height: 0 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  },
                  {
                    transform: [{ translateX: sidebarAnimation }],
                  },
                ]}
              >
                {/* Gradient Background */}
                <LinearGradient
                  colors={
                    isDarkMode
                      ? ["#1A1A1A", "#2A2A2A", "#1A1A1A"]
                      : ["#FFFFFF", "#F8F9FA", "#FFFFFF"]
                  }
                  style={{
                    flex: 1,
                    paddingTop: 60,
                  }}
                >
                  {/* Simplified Header */}
                  <View
                    style={{
                      padding: 20,
                      borderBottomWidth: 1,
                      borderBottomColor: isDarkMode ? "#333" : "#E0E0E0",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: isDarkMode ? "#4CAF50" : "#2E7D32",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>🚗</Text>
                        </View>
                        <View>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "bold",
                              color: isDarkMode ? "#FFF" : "#000",
                            }}
                          >
                            LNMIIT Carpool
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: isDarkMode ? "#CCC" : "#666",
                            }}
                          >
                            Smart. Safe. Sustainable.
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: isDarkMode
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onPress={toggleSidebar}
                      >
                        <IconButton
                          icon="close"
                          size={18}
                          iconColor={isDarkMode ? "#FFF" : "#000"}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Status Badge */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#4CAF50",
                          marginRight: 8,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          color: isDarkMode ? "#CCC" : "#666",
                        }}
                      >
                        Online • 3 Active Rides
                      </Text>
                    </View>
                  </View>

                  {/* User Info */}
                  <View
                    style={{
                      padding: 20,
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: isDarkMode
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                      marginHorizontal: 20,
                      marginTop: 20,
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: isDarkMode ? "#333" : "#F0F0F0",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>👤</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: isDarkMode ? "#FFF" : "#000",
                        }}
                      >
                        {user.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: isDarkMode ? "#CCC" : "#666",
                        }}
                      >
                        {user.branch} • {user.year}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: isDarkMode ? "#CCC" : "#666",
                          marginTop: 4,
                        }}
                      >
                        ⭐ {user.rating}
                      </Text>
                    </View>
                  </View>

                  {/* Navigation Items */}
                  <ScrollView
                    style={{ flex: 1, padding: 20 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Quick Actions */}
                    <View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: isDarkMode ? "#999" : "#666",
                          marginBottom: 12,
                          letterSpacing: 1,
                        }}
                      >
                        QUICK ACTIONS
                      </Text>

                      {[
                        {
                          icon: "🔍",
                          label: "Search Rides",
                          count: 12,
                          color: "#4CAF50",
                          action: () => {
                            setSidebarVisible(false);
                            Alert.alert(
                              "🔍 Search Rides",
                              "Find rides to any destination across Jaipur and beyond.",
                              [{ text: "Got it!", style: "default" }]
                            );
                          },
                        },
                        {
                          icon: "🚗",
                          label: "Create New Ride",
                          count: "New",
                          color: "#2196F3",
                          action: () => {
                            setSidebarVisible(false);
                            Alert.alert(
                              "Create Ride",
                              "Opening create ride screen..."
                            );
                          },
                        },
                        {
                          icon: "🚌",
                          label: "Bus Booking",
                          count: "Available",
                          color: "#FF9800",
                          action: () => {
                            setSidebarVisible(false);
                            setIndex(1); // Switch to bus booking tab
                          },
                        },
                        {
                          icon: "📋",
                          label: "My Ride History",
                          count: 8,
                          color: "#9C27B0",
                          action: () => {
                            setSidebarVisible(false);
                            Alert.alert(
                              "📋 Ride History",
                              "View all your past rides, earnings, and trip statistics.",
                              [{ text: "Got it!", style: "default" }]
                            );
                          },
                        },
                      ].map((item, index) => (
                        <TouchableOpacity
                          key={index}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            marginBottom: 12,
                            backgroundColor: isDarkMode
                              ? "rgba(255,255,255,0.05)"
                              : item.color + "10",
                            borderLeftWidth: 4,
                            borderLeftColor: item.color,
                            shadowColor: item.color,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 2,
                          }}
                          onPress={item.action}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: item.color + "20",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 12,
                            }}
                          >
                            <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: "600",
                                color: isDarkMode ? "#FFF" : "#000",
                                marginBottom: 2,
                              }}
                            >
                              {item.label}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: isDarkMode ? "#AAA" : "#666",
                              }}
                            >
                              {typeof item.count === "number"
                                ? `${item.count} available`
                                : item.count}
                            </Text>
                          </View>
                          <View
                            style={{
                              backgroundColor: item.color,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 12,
                              minWidth: 24,
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: "#FFF",
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              {item.count}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Emergency SOS Button */}
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#FF4444",
                        padding: 16,
                        borderRadius: 12,
                        marginTop: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        shadowColor: "#FF4444",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4,
                      }}
                      onPress={() => {
                        Alert.alert(
                          "🚨 Emergency Alert",
                          "Emergency services have been notified. Your location and emergency contacts will be contacted immediately.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Send Alert",
                              style: "destructive",
                              onPress: () => {
                                Alert.alert(
                                  "✅ Alert Sent",
                                  "Emergency alert has been sent successfully. Help is on the way.",
                                  [{ text: "OK" }]
                                );
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "rgba(255,255,255,0.2)",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>🚨</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: "#FFF",
                            fontSize: 16,
                            fontWeight: "600",
                            marginBottom: 2,
                          }}
                        >
                          Emergency SOS
                        </Text>
                        <Text
                          style={{
                            color: "rgba(255,255,255,0.8)",
                            fontSize: 12,
                          }}
                        >
                          Tap for immediate help
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#FFF",
                          opacity: 0.8,
                        }}
                      />
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                  </ScrollView>

                  {/* Enhanced Footer */}
                  <View
                    style={{
                      padding: 20,
                      borderTopWidth: 1,
                      borderTopColor: isDarkMode ? "#333" : "#E0E0E0",
                      paddingBottom: 40,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: isDarkMode ? "#666" : "#999",
                        textAlign: "center",
                      }}
                    >
                      LNMIIT Carpool v2.1
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: isDarkMode ? "#555" : "#CCC",
                        textAlign: "center",
                        marginTop: 4,
                      }}
                    >
                      Safe. Reliable. Connected.
                    </Text>
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Enhanced Overlay */}
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: "100%",
                    height: "100%",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    zIndex: 9999, // Just below sidebar
                    elevation: 49,
                  },
                  {
                    opacity: sidebarAnimation.interpolate({
                      inputRange: [-400, 0],
                      outputRange: [0, 1],
                      extrapolate: "clamp",
                    }),
                  },
                ]}
              >
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={1}
                  onPress={toggleSidebar}
                />
              </Animated.View>
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

AppContent.displayName = "AppContent";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  return (
    <PaperProvider theme={lightTheme}>
      {session && session.user ? (
        <AppContent session={session} />
      ) : (
        <Auth onAuthenticated={() => {}} isDarkMode={false} />
      )}
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  logoEmoji: {
    fontSize: 20,
  },
  titleContainer: {
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#CCCCCC",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    margin: 0,
  },
  avatar: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarGradient: {
    borderRadius: 20,
    padding: 2,
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  sceneContainer: {
    flex: 1,
  },
  bottomNavContainer: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 16,
    paddingBottom: 20,
    marginBottom: 0,
    alignItems: "center",
    justifyContent: "space-around",
    position: "relative", // Ensure it respects z-index
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 50,
    maxWidth: 80,
  },
  activeTabItem: {
    transform: [{ scale: 1.05 }],
  },
  tabButton: {
    margin: 0,
    padding: 6,
    backgroundColor: "transparent",
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  tabIconContainer: {
    borderRadius: 12,
    padding: 4,
  },
  activeIndicator: {
    position: "absolute",
    bottom: 0,
    left: "50%",
    marginLeft: -12,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  sectionLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionLoadingText: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
  },
});
