export interface Ride {
  id: string;
  driverId: string;
  origin: string;
  destination: string;
  departureTime: Date;
  availableSeats: number;
  totalSeats: number;
  pricePerSeat: number;
  status: "active" | "completed" | "cancelled" | "in_progress";
  vehicleInfo: VehicleInfo;
  route?: RoutePoint[];
  passengers: RidePassenger[];
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced Carpool Ride Schema
export interface CarpoolRide {
  id: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  driverPhoto: string;
  driverBranch: string;
  driverYear: string;
  driverPhone?: string;
  from: string;
  to: string;
  departureTime: string;
  date: string;
  availableSeats: number;
  totalSeats: number;
  pricePerSeat: number;
  vehicleInfo: VehicleInfo;
  route: string[];
  preferences: RidePreferences;
  status:
    | "active"
    | "full"
    | "completed"
    | "cancelled"
    | "expired"
    | "in_progress";
  passengers: CarpoolPassenger[];
  pendingRequests: JoinRequest[];
  chatEnabled: boolean;
  instantBooking: boolean; // If true, auto-accept; if false, driver must confirm
  estimatedDuration: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CarpoolPassenger {
  id: string;
  name: string;
  photo: string;
  branch?: string;
  year?: string;
  rating?: number;
  phone?: string;
  joinedAt: string;
  status: "pending" | "accepted" | "confirmed" | "cancelled";
  seatsBooked: number;
  pickupPoint?: string;
  dropoffPoint?: string;
  paymentStatus: "pending" | "paid" | "refunded";
}

export interface JoinRequest {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerPhoto: string;
  passengerBranch?: string;
  passengerYear?: string;
  passengerRating?: number;
  seatsRequested: number;
  message?: string;
  pickupPreference?: string;
  dropoffPreference?: string;
  requestedAt: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
}

export interface RidePreferences {
  gender?: "male" | "female" | "any";
  smokingAllowed: boolean;
  musicAllowed: boolean;
  petsAllowed: boolean;
  chatRequired?: boolean;
  verificationRequired?: boolean;
}

export interface VehicleInfo {
  make: string;
  model: string;
  color: string;
  licensePlate?: string;
  year?: number;
  isAC?: boolean;
  capacity?: number;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  address: string;
  estimatedTime?: Date;
}

export interface RidePassenger {
  id: string;
  rideId: string;
  passengerId: string;
  seatsBooked: number;
  status: "booked" | "confirmed" | "completed" | "cancelled";
  pickupPoint?: RoutePoint;
  dropoffPoint?: RoutePoint;
  bookedAt: Date;
}

// Create Ride Request for new enhanced system
export interface CreateCarpoolRideRequest {
  from: string;
  to: string;
  departureTime: string;
  date: string;
  availableSeats: number;
  pricePerSeat: number;
  vehicleInfo: VehicleInfo;
  route: string[];
  preferences: RidePreferences;
  description?: string;
  instantBooking: boolean;
  estimatedDuration?: string;
}

// Join Ride Request
export interface JoinCarpoolRideRequest {
  rideId: string;
  seatsRequested: number;
  message?: string;
  pickupPreference?: string;
  dropoffPreference?: string;
}

// Response from driver for join requests
export interface RespondToJoinRequest {
  requestId: string;
  response: "accept" | "reject";
  message?: string;
}

export interface CreateRideRequest {
  origin: string;
  destination: string;
  departureTime: string;
  availableSeats: number;
  pricePerSeat: number;
  vehicleInfo: VehicleInfo;
  route?: RoutePoint[];
}

export interface BookRideRequest {
  rideId: string;
  seatsBooked: number;
  pickupPoint?: RoutePoint;
  dropoffPoint?: RoutePoint;
}

export interface RideSearchFilters {
  origin?: string;
  destination?: string;
  date?: string;
  maxPrice?: number;
  minSeats?: number;
  gender?: "male" | "female" | "any";
  smokingAllowed?: boolean;
  musicAllowed?: boolean;
  petsAllowed?: boolean;
}

export interface RideRating {
  id: string;
  rideId: string;
  raterId: string;
  ratedUserId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

// Chat integration
export interface RideChat {
  id: string;
  rideId: string;
  participants: string[];
  createdAt: string;
  lastMessage?: {
    senderId: string;
    message: string;
    timestamp: string;
  };
}

// Notification types for carpool system
export interface CarpoolNotification {
  id: string;
  userId: string;
  type:
    | "join_request"
    | "request_accepted"
    | "request_rejected"
    | "ride_updated"
    | "ride_cancelled"
    | "chat_message";
  title: string;
  message: string;
  data: {
    rideId?: string;
    requestId?: string;
    chatId?: string;
  };
  read: boolean;
  createdAt: string;
}

// Dummy default export to satisfy Expo Router
export default function RideModel() {
  return null;
}
