import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  Image,
  Share,
  PanResponder,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { socketService, RideRequest } from "../services/SocketService";
import { supabase } from "../lib/supabase";
import { CarpoolRide, JoinRequest, CarpoolPassenger } from "../models/ride";
import NotificationService from "../services/NotificationService";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

// Avatar generation utility
const generateAvatarFromName = (name: string, size: number = 40): string => {
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
    .substring(0, 2);

  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FECA57",
    "#FF9FF3",
    "#54A0FF",
    "#5F27CD",
    "#00D2D3",
    "#FF9F43",
    "#FFA502",
    "#2ED573",
    "#1E90FF",
    "#3742FA",
    "#FF6348",
  ];

  const colorIndex = name.length % colors.length;
  const backgroundColor = colors[colorIndex];

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    initials
  )}&size=${size}&background=${backgroundColor.slice(
    1
  )}&color=fff&bold=true&format=svg`;
};

interface RideDetailsProps {
  rideId: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
    branch: string;
    year: string;
    rating: number;
    photo: string;
  };
  visible: boolean;
  onBack: () => void;
  onJoinRide: (rideId: string) => void;
  onStartChat: (rideId: string, rideTitle: string) => void;
}

export default function RideDetailsScreen({
  rideId,
  currentUser,
  visible,
  onBack,
  onJoinRide,
  onStartChat,
}: RideDetailsProps) {
  const [ride, setRide] = useState<CarpoolRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [passengers, setPassengers] = useState<CarpoolPassenger[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [joinRequestSent, setJoinRequestSent] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const isDriverCurrentUser = ride?.driverId === currentUser.id;
  const hasJoined = passengers.some((p) => p.id === currentUser.id);
  const canJoin =
    !isDriverCurrentUser && !hasJoined && ride && ride.availableSeats > 0;

  // Fetch ride details from database
  useEffect(() => {
    if (visible && rideId) {
      fetchRideDetails();
    }
  }, [visible, rideId]);

  const fetchRideDetails = async () => {
    try {
      setLoading(true);

      // Fetch ride details
      const { data: rideData, error: rideError } = await supabase
        .from("carpool_rides")
        .select("*")
        .eq("id", rideId)
        .single();

      if (rideError) {
        console.error("Error fetching ride:", rideError);
        Alert.alert("Error", "Failed to load ride details");
        return;
      }

      // Transform database data to CarpoolRide interface
      const transformedRide: CarpoolRide = {
        id: rideData.id,
        driverId: rideData.driver_id,
        driverName: rideData.driver_name,

        driverPhone: rideData.driver_phone || "",
        driverRating: 4.5, // Default rating
        driverPhoto: generateAvatarFromName(rideData.driver_name),
        driverBranch: "CSE", // Default branch
        driverYear: "2024", // Default year
        from: rideData.from_location,
        to: rideData.to_location,
        departureTime: new Date(rideData.departure_time).toLocaleTimeString(
          "en-US",
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }
        ),
        date: new Date(rideData.departure_date).toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        availableSeats: rideData.available_seats,
        totalSeats: rideData.total_seats,
        pricePerSeat: rideData.price_per_seat,
        vehicleInfo: {
          make: rideData.vehicle_make || "Unknown",
          model: rideData.vehicle_model || "Unknown",
          color: rideData.vehicle_color || "Unknown",
          licensePlate: rideData.license_plate || "N/A",
          isAC: rideData.is_ac || false,
        },
        route: [rideData.from_location, rideData.to_location],
        preferences: {
          smokingAllowed: rideData.smoking_allowed || false,
          musicAllowed: rideData.music_allowed || true,
          petsAllowed: rideData.pets_allowed || false,
        },
        status: rideData.status as
          | "active"
          | "full"
          | "completed"
          | "cancelled"
          | "expired",
        instantBooking: rideData.instant_booking || true,
        chatEnabled: rideData.chat_enabled || true,
        estimatedDuration: rideData.estimated_duration || "30 mins",
        expiresAt: rideData.expires_at,
        createdAt: rideData.created_at,
        passengers: [],
        pendingRequests: [],
      };

      setRide(transformedRide);

      // Fetch passengers
      const { data: passengersData, error: passengersError } = await supabase
        .from("ride_passengers")
        .select("*")
        .eq("ride_id", rideId);

      if (!passengersError && passengersData) {
        const transformedPassengers: CarpoolPassenger[] = passengersData.map(
          (p) => ({
            id: p.passenger_id,
            name: p.passenger_name,
            photo: generateAvatarFromName(p.passenger_name),
            seatsBooked: p.seats_booked,
            status: p.status as "pending" | "accepted" | "confirmed",
            joinedAt: p.joined_at,
            paymentStatus: "pending" as const,
          })
        );
        setPassengers(transformedPassengers);
      }

      // Fetch join requests (for drivers)
      if (transformedRide.driverId === currentUser.id) {
        const { data: requestsData, error: requestsError } = await supabase
          .from("join_requests")
          .select("*")
          .eq("ride_id", rideId)
          .eq("status", "pending");

        if (!requestsError && requestsData) {
          const transformedRequests: JoinRequest[] = requestsData.map((r) => ({
            id: r.id,
            passengerId: r.passenger_id,
            passengerName: r.passenger_name,
            passengerPhoto: generateAvatarFromName(r.passenger_name),
            seatsRequested: r.seats_requested,
            message: r.message || "",
            status: r.status as "pending" | "accepted" | "rejected",
            requestedAt: r.created_at,
          }));
          setJoinRequests(transformedRequests);
        }
      }

      // Check if current user has already sent a request
      const { data: userRequestData } = await supabase
        .from("join_requests")
        .select("*")
        .eq("ride_id", rideId)
        .eq("passenger_id", currentUser.id)
        .single();

      if (userRequestData) {
        setJoinRequestSent(true);
      }
    } catch (error) {
      console.error("Error in fetchRideDetails:", error);
      Alert.alert("Error", "Failed to load ride details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      // Animate slide up
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate slide down
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (isDriverCurrentUser) {
      // Listen for ride requests if current user is the driver
      socketService.onRideRequest((request: RideRequest) => {
        if (request.rideId === ride?.id) {
          setRideRequests((prev) => [...prev, request]);
        }
      });

      return () => {
        socketService.offRideRequest();
      };
    }
  }, [isDriverCurrentUser, ride?.id]);

  const handleJoinRide = async () => {
    if (canJoin && ride) {
      try {
        // Check if user has already joined this ride
        const { data: existingPassenger } = await supabase
          .from("ride_passengers")
          .select("id")
          .eq("ride_id", ride.id)
          .eq("passenger_id", currentUser.id)
          .single();

        if (existingPassenger) {
          Alert.alert("Info", "You have already joined this ride!");
          return;
        }

        // Check if user has already sent a request for this ride
        const { data: existingRequest } = await supabase
          .from("join_requests")
          .select("id, status")
          .eq("ride_id", ride.id)
          .eq("passenger_id", currentUser.id)
          .single();

        if (existingRequest) {
          if (existingRequest.status === "pending") {
            Alert.alert(
              "Info",
              "You have already sent a request for this ride!"
            );
          } else if (existingRequest.status === "accepted") {
            Alert.alert(
              "Info",
              "Your request for this ride has already been accepted!"
            );
          } else if (existingRequest.status === "rejected") {
            Alert.alert(
              "Info",
              "Your request for this ride was previously rejected. Please try a different ride."
            );
          }
          return;
        }

        // Create join request in database
        const { data: joinRequestData, error } = await supabase
          .from("join_requests")
          .insert({
            ride_id: ride.id,
            passenger_id: currentUser.id,
            passenger_name: currentUser.name,
            passenger_email: currentUser.email,
            seats_requested: 1,
            message: `Hi! I'd like to join your ride from ${ride.from} to ${ride.to}.`,
            status: "pending",
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating join request:", error);
          Alert.alert("Error", "Failed to send join request");
          return;
        }

        if (ride.instantBooking) {
          // For instant booking, add directly to passengers
          const { error: passengerError } = await supabase
            .from("ride_passengers")
            .insert({
              ride_id: ride.id,
              passenger_id: currentUser.id,
              passenger_name: currentUser.name,
              passenger_email: currentUser.email,
              seats_booked: 1,
              status: "confirmed",
              joined_at: new Date().toISOString(),
            });

          if (!passengerError) {
            // Update available seats
            await supabase
              .from("carpool_rides")
              .update({
                available_seats: ride.availableSeats - 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", ride.id);

            // Update join request to accepted for instant booking
            await supabase
              .from("join_requests")
              .update({
                status: "accepted",
                updated_at: new Date().toISOString(),
              })
              .eq("id", joinRequestData.id);

            Alert.alert("Success", "You have successfully joined the ride!");
            fetchRideDetails(); // Refresh data
          }
        } else {
          // For request-based booking, send notification to driver
          await NotificationService.notifyJoinRequest(
            ride.driverId,
            currentUser.name,
            ride.id,
            joinRequestData.id,
            ride.from,
            ride.to
          );

          // Send ride request via Socket.IO for real-time updates
          const rideRequest = {
            userId: currentUser.id,
            userName: currentUser.name,
            userPhoto: currentUser.photo,
            rideId: ride.id,
            requestId: joinRequestData.id,
          };

          socketService.sendRideRequest(rideRequest);
          setJoinRequestSent(true);
          Alert.alert(
            "Success",
            "Join request sent to driver! They will be notified."
          );
        }

        // Also call the original join ride function
        onJoinRide(ride.id);
      } catch (error) {
        console.error("Error in handleJoinRide:", error);
        Alert.alert("Error", "Failed to join ride");
      }
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const request = joinRequests.find((r) => r.id === requestId);
      if (!request || !ride) return;

      // Get the full request details from database including email
      const { data: requestData, error: requestError } = await supabase
        .from("join_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError || !requestData) {
        Alert.alert("Error", "Could not fetch request details");
        return;
      }

      // Update request status to accepted
      const { error: updateError } = await supabase
        .from("join_requests")
        .update({
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("Error accepting request:", updateError);
        Alert.alert("Error", "Failed to accept request");
        return;
      }

      // Check if passenger already exists for this ride
      const { data: existingPassenger } = await supabase
        .from("ride_passengers")
        .select("id")
        .eq("ride_id", ride.id)
        .eq("passenger_id", request.passengerId)
        .single();

      if (existingPassenger) {
        Alert.alert("Info", "This passenger has already joined the ride!");
        return;
      }

      // Add passenger to ride
      const { error: passengerError } = await supabase
        .from("ride_passengers")
        .insert({
          ride_id: ride.id,
          passenger_id: request.passengerId,
          passenger_name: request.passengerName,
          passenger_email: requestData.passenger_email,
          seats_booked: request.seatsRequested,
          status: "confirmed",
          joined_at: new Date().toISOString(),
        });

      if (passengerError) {
        console.error("Error adding passenger:", passengerError);
        Alert.alert("Error", "Failed to add passenger");
        return;
      }

      // Update available seats
      await supabase
        .from("carpool_rides")
        .update({
          available_seats: ride.availableSeats - request.seatsRequested,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ride.id);

      // Send notification to passenger
      await NotificationService.notifyRequestAccepted(
        request.passengerId,
        currentUser.name,
        ride.id,
        ride.from,
        ride.to
      );

      socketService.acceptRideRequest(requestId);
      Alert.alert(
        "Success",
        "Request accepted! The passenger has been notified."
      );
      fetchRideDetails(); // Refresh data
    } catch (error) {
      console.error("Error in handleAcceptRequest:", error);
      Alert.alert("Error", "Failed to accept request");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const request = joinRequests.find((r) => r.id === requestId);
      if (!request || !ride) return;

      // Update request status to rejected
      const { error } = await supabase
        .from("join_requests")
        .update({
          status: "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) {
        console.error("Error rejecting request:", error);
        Alert.alert("Error", "Failed to reject request");
        return;
      }

      // Send notification to passenger
      await NotificationService.notifyRequestRejected(
        request.passengerId,
        currentUser.name,
        ride.id,
        ride.from,
        ride.to
      );

      socketService.rejectRideRequest(requestId);
      Alert.alert(
        "Success",
        "Request declined. The passenger has been notified."
      );
      fetchRideDetails(); // Refresh data
    } catch (error) {
      console.error("Error in handleRejectRequest:", error);
      Alert.alert("Error", "Failed to reject request");
    }
  };

  const handleStartChat = () => {
    if (!ride) return;
    const rideTitle = `${ride.from} → ${ride.to}`;
    onStartChat(ride.id, rideTitle);
  };

  const handleCallDriver = async () => {
    const phoneNumber = "+919876543210"; // Demo phone number
    try {
      const supported = await Linking.canOpenURL(`tel:${phoneNumber}`);
      if (supported) {
        await Linking.openURL(`tel:${phoneNumber}`);
      } else {
        Alert.alert(
          "Call Driver",
          `Phone: ${phoneNumber}\n\nYour device doesn't support direct calling. Please dial manually.`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Unable to make call. Please try again.");
      console.log("Error calling:", error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this carpool ride from ${ride?.from} to ${ride?.to} on ${ride?.date} at ${ride?.departureTime}. Driver: ${ride?.driverName} (${ride?.driverRating}⭐). Price: ₹${ride?.pricePerSeat} per seat.`,
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return gestureState.dy > 0 && gestureState.vy > 0;
    },
    onPanResponderMove: (evt, gestureState) => {
      if (gestureState.dy > 0) {
        slideAnim.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dy > 100 || gestureState.vy > 0.5) {
        onBack();
      } else {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onBack}
    >
      <View style={{ flex: 1 }}>
        {/* Overlay */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            opacity: overlayOpacity,
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={onBack}
          />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: SCREEN_HEIGHT * 0.85,
            backgroundColor: "#FFF",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            transform: [{ translateY: slideAnim }],
          }}
          {...panResponder.panHandlers}
        >
          {/* Handle */}
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: "#DDD",
              borderRadius: 2,
              alignSelf: "center",
              marginTop: 8,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#E0E0E0",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "600", color: "#000" }}>
              Ride Details
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setIsFavorited(!isFavorited)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#F5F5F5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={isFavorited ? "heart" : "heart-outline"}
                  size={20}
                  color={isFavorited ? "#FF0000" : "#666"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#F5F5F5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="share-outline" size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onBack}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#F5F5F5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            {loading ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 100,
                }}
              >
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={{ marginTop: 16, fontSize: 16, color: "#666" }}>
                  Loading ride details...
                </Text>
              </View>
            ) : !ride ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 100,
                }}
              >
                <Text style={{ fontSize: 18, color: "#666", marginBottom: 16 }}>
                  Ride not found
                </Text>
                <TouchableOpacity
                  onPress={onBack}
                  style={{
                    backgroundColor: "#4CAF50",
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#FFF", fontWeight: "600" }}>
                    Go Back
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Driver Info */}
                <View style={{ padding: 20 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#F8F9FA",
                      padding: 16,
                      borderRadius: 16,
                      marginBottom: 20,
                    }}
                  >
                    <Image
                      source={{ uri: ride?.driverPhoto }}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        marginRight: 16,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "600",
                            color: "#000",
                          }}
                        >
                          {ride?.driverName}
                        </Text>
                        <View
                          style={{
                            backgroundColor: "#4CAF50",
                            borderRadius: 8,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            marginLeft: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              color: "#FFF",
                              fontWeight: "600",
                            }}
                          >
                            VERIFIED
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 4,
                        }}
                      >
                        <Ionicons name="star" size={16} color="#FFD700" />
                        <Text
                          style={{ fontSize: 14, color: "#666", marginLeft: 4 }}
                        >
                          {ride?.driverRating} • {ride?.driverBranch} •{" "}
                          {ride?.driverYear}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={handleCallDriver}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "#000",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="call" size={18} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleStartChat}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "#000",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="chatbubble" size={18} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Route Info */}
                  <View
                    style={{
                      backgroundColor: "#F8F9FA",
                      padding: 16,
                      borderRadius: 16,
                      marginBottom: 20,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#000",
                        marginBottom: 12,
                      }}
                    >
                      Route Details
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: "#4CAF50",
                          marginRight: 12,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 16,
                          color: "#000",
                          fontWeight: "500",
                        }}
                      >
                        {ride?.from}
                      </Text>
                    </View>

                    <View
                      style={{
                        width: 2,
                        height: 30,
                        backgroundColor: "#DDD",
                        marginLeft: 5,
                        marginVertical: 4,
                      }}
                    />

                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: "#FF5722",
                          marginRight: 12,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 16,
                          color: "#000",
                          fontWeight: "500",
                        }}
                      >
                        {ride?.to}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: 16,
                        paddingTop: 16,
                        borderTopWidth: 1,
                        borderTopColor: "#E0E0E0",
                      }}
                    >
                      <View style={{ alignItems: "center" }}>
                        <Ionicons name="calendar" size={20} color="#666" />
                        <Text
                          style={{ fontSize: 14, color: "#666", marginTop: 4 }}
                        >
                          {ride?.date}
                        </Text>
                      </View>
                      <View style={{ alignItems: "center" }}>
                        <Ionicons name="time" size={20} color="#666" />
                        <Text
                          style={{ fontSize: 14, color: "#666", marginTop: 4 }}
                        >
                          {ride?.departureTime}
                        </Text>
                      </View>
                      <View style={{ alignItems: "center" }}>
                        <Ionicons name="people" size={20} color="#666" />
                        <Text
                          style={{ fontSize: 14, color: "#666", marginTop: 4 }}
                        >
                          {ride?.availableSeats}/{ride?.totalSeats} seats
                        </Text>
                      </View>
                      <View style={{ alignItems: "center" }}>
                        <Ionicons name="cash" size={20} color="#666" />
                        <Text
                          style={{ fontSize: 14, color: "#666", marginTop: 4 }}
                        >
                          ₹{ride?.pricePerSeat}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Vehicle Info */}
                  <View
                    style={{
                      backgroundColor: "#F8F9FA",
                      padding: 16,
                      borderRadius: 16,
                      marginBottom: 20,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#000",
                        marginBottom: 12,
                      }}
                    >
                      Vehicle Information
                    </Text>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Ionicons
                        name="car"
                        size={24}
                        color="#666"
                        style={{ marginRight: 12 }}
                      />
                      <View>
                        <Text
                          style={{
                            fontSize: 16,
                            color: "#000",
                            fontWeight: "500",
                          }}
                        >
                          {ride?.vehicleInfo.make} {ride?.vehicleInfo.model}
                        </Text>
                        <Text style={{ fontSize: 14, color: "#666" }}>
                          {ride?.vehicleInfo.color} •{" "}
                          {ride?.vehicleInfo.isAC ? "AC Available" : "Non-AC"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Preferences */}
                  <View
                    style={{
                      backgroundColor: "#F8F9FA",
                      padding: 16,
                      borderRadius: 16,
                      marginBottom: 20,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#000",
                        marginBottom: 12,
                      }}
                    >
                      Ride Preferences
                    </Text>
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      {[
                        {
                          key: "music",
                          label: "Music",
                          icon: "musical-notes",
                          allowed: ride?.preferences.musicAllowed,
                        },
                        {
                          key: "smoking",
                          label: "Smoking",
                          icon: "ban",
                          allowed: ride?.preferences.smokingAllowed,
                        },
                        {
                          key: "pets",
                          label: "Pets",
                          icon: "paw",
                          allowed: ride?.preferences.petsAllowed,
                        },
                      ].map((pref) => (
                        <View
                          key={pref.key}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: pref.allowed
                              ? "#E8F5E8"
                              : "#FFE8E8",
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                          }}
                        >
                          <Ionicons
                            name={pref.icon as any}
                            size={16}
                            color={pref.allowed ? "#4CAF50" : "#F44336"}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={{
                              fontSize: 14,
                              color: pref.allowed ? "#4CAF50" : "#F44336",
                              fontWeight: "500",
                            }}
                          >
                            {pref.label} {pref.allowed ? "OK" : "Not OK"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Current Passengers */}
                  {passengers.length > 0 && (
                    <View
                      style={{
                        backgroundColor: "#F8F9FA",
                        padding: 16,
                        borderRadius: 16,
                        marginBottom: 20,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#000",
                          marginBottom: 12,
                        }}
                      >
                        Current Passengers ({passengers.length})
                      </Text>
                      {passengers.map((passenger) => (
                        <View
                          key={passenger.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                          }}
                        >
                          <Image
                            source={{ uri: passenger.photo }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              marginRight: 12,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 16,
                                color: "#000",
                                fontWeight: "500",
                              }}
                            >
                              {passenger.name}
                            </Text>
                            <Text style={{ fontSize: 12, color: "#666" }}>
                              Joined{" "}
                              {new Date(
                                passenger.joinedAt
                              ).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Join Requests (Driver Only) */}
                  {isDriverCurrentUser && joinRequests.length > 0 && (
                    <View
                      style={{
                        backgroundColor: "#FFF3E0",
                        padding: 16,
                        borderRadius: 16,
                        marginBottom: 20,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#000",
                          marginBottom: 12,
                        }}
                      >
                        Join Requests ({joinRequests.length})
                      </Text>
                      {joinRequests.map((request) => (
                        <View
                          key={request.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: "#E0E0E0",
                          }}
                        >
                          <Image
                            source={{ uri: request.passengerPhoto }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              marginRight: 12,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 16,
                                color: "#000",
                                fontWeight: "500",
                              }}
                            >
                              {request.passengerName}
                            </Text>
                            <Text style={{ fontSize: 12, color: "#666" }}>
                              {request.message && request.message.length > 0
                                ? request.message
                                : "No message"}
                            </Text>
                            <Text style={{ fontSize: 10, color: "#999" }}>
                              {new Date(
                                request.requestedAt
                              ).toLocaleTimeString()}
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => handleAcceptRequest(request.id)}
                              style={{
                                backgroundColor: "#4CAF50",
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 20,
                              }}
                            >
                              <Text
                                style={{ color: "#FFF", fontWeight: "600" }}
                              >
                                Accept
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRejectRequest(request.id)}
                              style={{
                                backgroundColor: "#F44336",
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 20,
                              }}
                            >
                              <Text
                                style={{ color: "#FFF", fontWeight: "600" }}
                              >
                                Reject
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {/* Bottom Action Bar */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#FFF",
              paddingHorizontal: 20,
              paddingVertical: 16,
              paddingBottom: 34,
              borderTopWidth: 1,
              borderTopColor: "#E0E0E0",
            }}
          >
            {canJoin && (
              <TouchableOpacity
                onPress={handleJoinRide}
                disabled={joinRequestSent}
                style={{
                  backgroundColor: joinRequestSent ? "#CCC" : "#000",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFF",
                  }}
                >
                  {joinRequestSent
                    ? "Request Sent"
                    : `Join Ride - ₹${ride?.pricePerSeat}`}
                </Text>
              </TouchableOpacity>
            )}

            {hasJoined && (
              <TouchableOpacity
                onPress={handleStartChat}
                style={{
                  backgroundColor: "#4CAF50",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFF",
                  }}
                >
                  Chat with Group
                </Text>
              </TouchableOpacity>
            )}

            {isDriverCurrentUser && (
              <TouchableOpacity
                onPress={handleStartChat}
                style={{
                  backgroundColor: "#2196F3",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFF",
                  }}
                >
                  Manage Ride
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
