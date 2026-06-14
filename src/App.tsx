/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  StatusBar,
  Platform,
  UIManager,
  LayoutAnimation,
  SafeAreaView,
  Animated,
  Image,
  Modal,
} from "react-native";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import MapView, { Marker, Polyline } from "react-native-maps";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import WebMap from "./WebMap";
import {
  MapPin,
  ArrowUpDown,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || "";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const platformFavicons: { [key: string]: string } = {
  Uber: "https://www.google.com/s2/favicons?domain=uber.com&sz=256",
  Ola: "https://www.google.com/s2/favicons?domain=olacabs.com&sz=256",
  Rapido: "https://www.google.com/s2/favicons?domain=rapido.bike&sz=256",
  inDrive: "https://www.google.com/s2/favicons?domain=indrive.com&sz=256",
  BluSmart: "https://www.google.com/s2/favicons?domain=blu-smart.com&sz=256",
  "Namma Yatri":
    "https://www.google.com/s2/favicons?domain=nammayatri.in&sz=256",
};

const PulsingPrice = ({ price, isSurge, isCheapest, style }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSurge) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSurge, pulseAnim]);

  return (
    <Animated.Text
      style={[
        style,
        isCheapest
          ? { color: "#00FF66", fontSize: 32, fontWeight: "900" }
          : { color: "#4E4E52", fontSize: 20, fontWeight: "600" },
        isSurge && !isCheapest && { color: "#9F2B48", opacity: 0.6 },
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      ₹{price}
    </Animated.Text>
  );
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("Login");
  const [user, setUser] = useState({ name: "", email: "", uid: "" });
  const [travelHistory, setTravelHistory] = useState([]);
  const [searchParams, setSearchParams] = useState({
    origin: "",
    destination: "",
  });
  const [routeData, setRouteData] = useState({
    distanceKm: 0,
    durationMin: 0,
    coordinates: null,
    trafficMarkers: [],
  });
  const [isSmartWaitActive, setIsSmartWaitActive] = useState(false);
  const [fares, setFares] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortBy, setSortBy] = useState("PRICE_ASC");
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isPromoApplied, setIsPromoApplied] = useState(false);

  // Auth State
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [showOriginSugg, setShowOriginSugg] = useState(false);
  const [showDestSugg, setShowDestSugg] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    let unsubTrips: any = null;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          name:
            firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "",
          email: firebaseUser.email || "",
          uid: firebaseUser.uid,
        });
        navigateTo("Dashboard");

        const q = query(
          collection(db, "trips"),
          where("userId", "==", firebaseUser.uid),
        );
        unsubTrips = onSnapshot(
          q,
          (snapshot) => {
            const trips: any = [];
            snapshot.forEach((doc) =>
              trips.push({ id: doc.id, ...doc.data() }),
            );
            trips.sort((a: any, b: any) => b.date - a.date);
            setTravelHistory(trips);
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, "trips");
          },
        );
      } else {
        if (unsubTrips) {
          unsubTrips();
          unsubTrips = null;
        }
        setUser({ name: "", email: "", uid: "" });
        navigateTo("Login");
        setTravelHistory([]);
      }
    });

    return () => {
      unsubscribe();
      if (unsubTrips) unsubTrips();
    };
  }, []);

  useEffect(() => {
    let intervalId;
    if (currentScreen === "FareMatrix") {
      intervalId = setInterval(() => {
        setFares((prevFares) =>
          prevFares.map((f) => {
            const chance = Math.random();
            let delta = 0;
            if (chance > 0.6) delta = 1;
            else if (chance < 0.3) delta = -1;

            const newEta = Math.max(1, f.eta + delta);
            return { ...f, eta: newEta };
          }),
        );
      }, 30000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentScreen]);

  const fetchGoogleRoute = async (oCoords, dCoords) => {
    try {
      if (oCoords && dCoords) {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${oCoords.lon},${oCoords.lat};${dCoords.lon},${dCoords.lat}?overview=full&geometries=geojson`,
        );
        const data = await res.json();
        if (data && data.routes && data.routes.length > 0) {
          const distanceKm = +(data.routes[0].distance / 1000).toFixed(1);

          let durationMin = Math.round(data.routes[0].duration / 60);

          // Traffic Simulation Logic based on time of day
          const hour = new Date().getHours();
          let trafficMultiplier = 1.0;
          if (hour >= 8 && hour <= 10)
            trafficMultiplier = 1.5; // Morning rush
          else if (hour >= 17 && hour <= 20)
            trafficMultiplier = 1.6; // Evening rush
          else if (hour >= 11 && hour <= 16)
            trafficMultiplier = 1.2; // Midday traffic
          else trafficMultiplier = 1.0; // Night traffic

          durationMin = Math.round(durationMin * trafficMultiplier);

          const coordinates = data.routes[0].geometry.coordinates.map((c) => ({
            lat: c[1],
            lon: c[0],
          }));

          let trafficMarkers = [];
          if (trafficMultiplier > 1.0) {
            let markerCount = 0;
            if (trafficMultiplier >= 1.5)
              markerCount = Math.max(3, Math.floor(coordinates.length / 10)); // heavy
            else if (trafficMultiplier >= 1.2)
              markerCount = Math.max(1, Math.floor(coordinates.length / 20)); // moderate

            const step = Math.floor(coordinates.length / (markerCount + 1));
            for (let i = 1; i <= markerCount; i++) {
              const idx = i * step;
              if (coordinates[idx]) {
                trafficMarkers.push({
                  ...coordinates[idx],
                  severity: trafficMultiplier >= 1.5 ? "heavy" : "moderate",
                });
              }
            }
          }

          return { distanceKm, durationMin, coordinates, trafficMarkers };
        }
      }
    } catch (e) {
      console.error(e);
    }
    const distanceKm = Math.floor(Math.random() * (15 - 5 + 1)) + 5;
    const durationMin = Math.floor(Math.random() * (45 - 15 + 1)) + 15;
    return { distanceKm, durationMin, coordinates: null, trafficMarkers: [] };
  };

  const checkServiceOperating = (platform: string, originStr: string) => {
    if (!originStr) return true;
    const originLower = originStr.toLowerCase();

    if (platform === "Namma Yatri") {
      const nyCities = [
        "bengaluru",
        "bangalore",
        "kochi",
        "kolkata",
        "chennai",
        "tumakuru",
        "mysore",
        "delhi",
        "new delhi",
        "hyderabad",
      ];
      return nyCities.some((city) => originLower.includes(city));
    }

    if (platform === "BluSmart") {
      const bsCities = [
        "delhi",
        "new delhi",
        "gurugram",
        "gurgaon",
        "noida",
        "bengaluru",
        "bangalore",
      ];
      return bsCities.some((city) => originLower.includes(city));
    }

    return true;
  };

  const getCityTierMultiplier = (originStr: string) => {
    if (!originStr) return 1.0;
    const originLower = originStr.toLowerCase();

    const tier1 = [
      "mumbai",
      "delhi",
      "bangalore",
      "bengaluru",
      "chennai",
      "kolkata",
      "hyderabad",
      "pune",
      "gurugram",
      "gurgaon",
      "noida",
    ];
    const tier2 = [
      "ahmedabad",
      "jaipur",
      "surat",
      "lucknow",
      "kanpur",
      "nagpur",
      "indore",
      "bhopal",
      "visakhapatnam",
      "patna",
      "vadodara",
      "kochi",
      "mysore",
      "chandigarh",
      "coimbatore",
    ];

    if (tier1.some((city) => originLower.includes(city))) return 1.15;
    if (tier2.some((city) => originLower.includes(city))) return 0.9;
    return 0.75; // Tier 3 and others
  };

  const calculateSmartFares = useCallback(
    (distanceKm, durationMin, currentHour, pxCount = 1) => {
      let vehicles = [
        {
          platform: "Uber",
          type: "Moto",
          base: 28,
          perKm: 8,
          perMin: 1.5,
          category: "Bikes",
          maxPx: 1,
        },
        {
          platform: "Uber",
          type: "Go",
          base: 56,
          perKm: 15,
          perMin: 2,
          category: "Cabs",
          maxPx: 4,
        },
        {
          platform: "Uber",
          type: "Premier",
          base: 70,
          perKm: 18,
          perMin: 2.5,
          category: "Cabs",
          maxPx: 4,
        },
        {
          platform: "Uber",
          type: "XL",
          base: 105,
          perKm: 22,
          perMin: 3.5,
          category: "SUVs",
          maxPx: 6,
        },
        {
          platform: "Ola",
          type: "Auto",
          base: 35,
          perKm: 12.5,
          perMin: 1.5,
          category: "Autos",
          maxPx: 3,
        },
        {
          platform: "Ola",
          type: "Mini",
          base: 60,
          perKm: 14.5,
          perMin: 2,
          category: "Cabs",
          maxPx: 4,
        },
        {
          platform: "Ola",
          type: "Prime",
          base: 70,
          perKm: 17,
          perMin: 2.5,
          category: "Cabs",
          maxPx: 4,
        },
        {
          platform: "Rapido",
          type: "Bike",
          base: 25,
          perKm: 7,
          perMin: 1,
          category: "Bikes",
          maxPx: 1,
        },
        {
          platform: "Rapido",
          type: "Auto",
          base: 32,
          perKm: 11,
          perMin: 1,
          category: "Autos",
          maxPx: 3,
        },
        {
          platform: "inDrive",
          type: "City",
          base: 49,
          perKm: 13,
          perMin: 1,
          category: "Cabs",
          maxPx: 4,
        },
        {
          platform: "BluSmart",
          type: "EV",
          base: 63,
          perKm: 14,
          perMin: 1.5,
          category: "Cabs",
          maxPx: 4,
        },
        {
          platform: "Namma Yatri",
          type: "Auto",
          base: 32,
          perKm: 10.5,
          perMin: 1,
          category: "Autos",
          maxPx: 3,
        },
        {
          platform: "Namma Yatri",
          type: "Cab",
          base: 52,
          perKm: 14,
          perMin: 1.5,
          category: "Cabs",
          maxPx: 4,
        },
      ];

      vehicles = vehicles.filter((v) => pxCount <= v.maxPx);
      const cityTierMultiplier = getCityTierMultiplier(origin);

      let smartWait = false;
      const calculatedFares = vehicles.map((v) => {
        let multiplier = 1.0;
        if (
          (currentHour >= 8 && currentHour < 11) ||
          (currentHour >= 17 && currentHour < 20)
        ) {
          if (v.category === "Cabs" || v.category === "SUVs") {
            multiplier = 1.25;
            smartWait = true;
            // BluSmart has no surge
            if (v.platform === "BluSmart") multiplier = 1.0;
          } else {
            multiplier = 1.1;
          }
        } else if (currentHour >= 23 || currentHour < 5) {
          multiplier = 1.2; // Night surge
          if (v.platform === "BluSmart") multiplier = 1.1;
        }

        // Calculate vehicle specific trip duration
        let vDuration = durationMin;
        if (v.category === "Bikes") {
          vDuration = Math.max(1, Math.round(durationMin * 0.7));
        } else if (v.category === "Autos") {
          vDuration = Math.max(1, Math.round(durationMin * 0.85));
        } else if (v.category === "Cabs") {
          if (
            v.type === "Premier" ||
            v.type === "Prime" ||
            v.type === "City" ||
            v.type === "EV"
          ) {
            vDuration = Math.round(durationMin * 1.15); // Takes slightly longer
          } else {
            vDuration = Math.round(durationMin * 1.05);
          }
        } else if (v.category === "SUVs") {
          vDuration = Math.round(durationMin * 1.3); // SUVs take the most time in traffic
        }

        let price = Math.round(
          (v.base + distanceKm * v.perKm + vDuration * v.perMin) *
            multiplier *
            cityTierMultiplier,
        );

        // Minimum fare logic to avoid unrealistic low prices
        const minFares: Record<string, number> = {
          Bikes: 35,
          Autos: 55,
          Cabs: 105,
          SUVs: 175,
        };
        if (price < minFares[v.category]) {
          price = minFares[v.category];
        }

        let baseETA = Math.floor(Math.random() * 3) + 2;

        // ETA adjustments based on category and traffic
        if (v.category === "Bikes") {
          baseETA = Math.max(1, baseETA - 1);
        } else if (v.category === "Autos") {
          baseETA = Math.max(2, baseETA);
        } else if (v.category === "Cabs") {
          baseETA = baseETA + Math.floor(Math.random() * 3) + 2;
        } else if (v.category === "SUVs") {
          baseETA = baseETA + Math.floor(Math.random() * 4) + 4;
        }

        if (multiplier >= 1.2 && v.platform !== "BluSmart") {
          baseETA += Math.floor(Math.random() * 4) + 2; // Heavy traffic adds 2-5 mins
        }
        if (v.platform === "BluSmart") baseETA += 8; // BluSmart usually has longer fixed dispatch Limits

        const isOperating = checkServiceOperating(v.platform, origin);

        // Carbon emissions logic
        let co2Factor = 0.15; // default Cabs (ICE)
        if (v.category === "Bikes") co2Factor = 0.05;
        else if (v.category === "Autos") co2Factor = 0.08;
        else if (v.category === "SUVs") co2Factor = 0.22;

        if (v.platform === "BluSmart" || v.type === "EV") co2Factor = 0;

        const co2Emission = Number((distanceKm * co2Factor).toFixed(2));

        return {
          id: `${v.platform}-${v.type}`,
          platform: v.platform,
          type: v.type,
          category: v.category,
          price: price,
          eta: baseETA,
          duration: vDuration,
          surge: multiplier > 1.0,
          operating: isOperating,
          co2: co2Emission,
        };
      });

      setIsSmartWaitActive(smartWait);
      const sortedFares = calculatedFares.sort((a, b) => a.price - b.price);
      setFares(sortedFares);
      return sortedFares;
    },
    [origin],
  );

  const handleBookRide = async (ride) => {
    let url = "";

    const oLat = originCoords?.lat || "";
    const oLon = originCoords?.lon || "";
    const dLat = destCoords?.lat || "";
    const dLon = destCoords?.lon || "";

    const originName = encodeURIComponent(searchParams.origin);
    const destName = encodeURIComponent(searchParams.destination);

    if (Platform.OS === "web") {
      if (ride.platform === "Uber") {
        url = `https://m.uber.com/ul/?action=setPickup&client_id=uber&pickup[formatted_address]=${originName}&pickup[latitude]=${oLat}&pickup[longitude]=${oLon}&dropoff[formatted_address]=${destName}&dropoff[latitude]=${dLat}&dropoff[longitude]=${dLon}`;
      } else if (ride.platform === "Ola") {
        url = `https://book.olacabs.com/?pickup_name=${originName}&drop_name=${destName}&lat=${oLat}&lng=${oLon}&drop_lat=${dLat}&drop_lng=${dLon}`;
      } else if (ride.platform === "Rapido") {
        url = `https://rapido.bike/?pickup_lat=${oLat}&pickup_lng=${oLon}&drop_lat=${dLat}&drop_lng=${dLon}`;
      } else if (ride.platform === "inDrive") {
        url = `https://indrive.com/?pickup_lat=${oLat}&pickup_lng=${oLon}&drop_lat=${dLat}&drop_lng=${dLon}`;
      } else if (ride.platform === "BluSmart") {
        url = `https://blu-smart.com/?pickup_lat=${oLat}&pickup_lng=${oLon}&drop_lat=${dLat}&drop_lng=${dLon}`;
      } else if (ride.platform === "Namma Yatri") {
        url = `https://nammayatri.in/?pickup_lat=${oLat}&pickup_lng=${oLon}&drop_lat=${dLat}&drop_lng=${dLon}`;
      } else {
        url = `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLon}&destination=${dLat},${dLon}&travelmode=driving`;
      }
    } else {
      url =
        ride.platform === "Uber"
          ? `uber://?action=setPickup&pickup[formatted_address]=${originName}&pickup[latitude]=${oLat}&pickup[longitude]=${oLon}&dropoff[formatted_address]=${destName}&dropoff[latitude]=${dLat}&dropoff[longitude]=${dLon}`
          : ride.platform === "Ola"
            ? `olacabs://app/launch?lat=${oLat}&lng=${oLon}&pickup_name=${originName}&drop_lat=${dLat}&drop_lng=${dLon}&drop_name=${destName}`
            : ride.platform === "Rapido"
              ? `rapido://?pickup_lat=${oLat}&pickup_lng=${oLon}&drop_lat=${dLat}&drop_lng=${dLon}`
              : `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLon}&destination=${dLat},${dLon}&travelmode=driving`;
    }

    try {
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          throw new Error("Not installed");
        }
      }
    } catch (e) {
      if (Platform.OS !== "web") {
        Alert.alert(
          "Redirecting to App Store",
          `The ${ride.platform} app is not installed on this device. [Mock Intent Fired]`,
        );
      }
    }

    const newRideData = {
      date: new Date().getTime(),
      origin: searchParams.origin,
      dest: searchParams.destination,
      platform: ride.platform,
      serviceName: ride.type,
      price: ride.price,
      distanceKm: routeData.distanceKm,
      co2: ride.co2,
      userId: user.uid,
    };

    // Save to Firestore
    try {
      await addDoc(collection(db, "trips"), newRideData);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "trips");
    }

    // Google Sheets Backup API
    try {
      await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: searchParams.origin,
          destination: searchParams.destination,
          distanceKm: routeData.distanceKm,
          durationMin: routeData.durationMin,
          farePaid: ride.price,
          userId: user.uid,
          userEmail: user.email,
        }),
      });
    } catch (e) {
      console.error("Sync failed", e);
    }
  };

  const navigateTo = (screen) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentScreen(screen);
  };

  const [authError, setAuthError] = useState("");

  const renderAuthScreen = () => {
    const onGoogleSignIn = async () => {
      setAuthError("");
      setIsLoading(true);
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        setUser({
          name:
            result.user.displayName || result.user.email?.split("@")[0] || "",
          email: result.user.email || "",
          uid: result.user.uid,
        });
        setCurrentScreen("Dashboard");
      } catch (err: any) {
        let msg = err.message || "An error occurred";
        setAuthError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: "#050505",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
        style={{ flex: 1, width: "100%", backgroundColor: "#050505" }}
      >
        <View style={styles.authLogoContainer}>
          <View style={styles.deckLogoStack}>
            <View
              style={[
                styles.deckLogoLayer,
                {
                  transform: [{ translateY: 0 }, { scaleX: 1.0 }],
                  opacity: 1.0,
                },
              ]}
            />
            <View
              style={[
                styles.deckLogoLayer,
                {
                  transform: [{ translateY: 8 }, { scaleX: 0.85 }],
                  opacity: 0.75,
                },
              ]}
            />
            <View
              style={[
                styles.deckLogoLayer,
                {
                  transform: [{ translateY: 16 }, { scaleX: 0.7 }],
                  opacity: 0.5,
                },
              ]}
            />
          </View>
          <Text
            style={styles.deckBrandTitle}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            FARESYNC
          </Text>
          <Text
            style={styles.deckBrandSubtitle}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            The Ultimate Transit Aggregator
          </Text>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.authSubtitle}>WELCOME</Text>
          <Text style={styles.authCardDescription}>
            Sign in to securely access and query unified transport fares across
            Uber, Ola, Rapido and more instantly.
          </Text>

          {authError ? (
            <View style={styles.authErrorContainer}>
              <Text style={styles.authErrorText}>{authError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
            onPress={onGoogleSignIn}
            disabled={isLoading}
          >
            <Text style={styles.primaryBtnText}>
              {isLoading ? "PROCESSING..." : "CONTINUE WITH GOOGLE"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dataStorageInfo}>
          <Text style={styles.dataStorageTitle}>🔒 DATA & PRIVACY</Text>
          <Text style={styles.dataStorageText}>
            For security, all user sessions and transit history logs are
            strictly persistent to your private Firebase Cloud Firestore
            database instance. Access is securely restricted to authenticated
            users only.
          </Text>
        </View>

        <View style={styles.authFooterContainer}>
          <Text style={styles.authFooterText}>
            ONEJOURNEY MOBILITY HACKATHON • TRACK: TRANSPARENT PRICING
          </Text>
        </View>
      </ScrollView>
    );
  };

  const [previewRoute, setPreviewRoute] = useState(null);

  useEffect(() => {
    const updatePreviewRoute = async () => {
      if (originCoords && destCoords) {
        try {
          const { distanceKm, durationMin, coordinates, trafficMarkers } =
            await fetchGoogleRoute(originCoords, destCoords);
          setPreviewRoute({
            distanceKm,
            durationMin,
            coordinates,
            trafficMarkers,
          });
        } catch (e) {
          console.error(e);
        }
      } else {
        setPreviewRoute(null);
      }
    };
    updatePreviewRoute();
  }, [originCoords, destCoords]);

  const handleOriginChange = async (text) => {
    setOrigin(text);
    setShowOriginSugg(true);
    setShowDestSugg(false);
    if (text.length > 2) {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
        const data = await res.json();
        setOriginSuggestions(data);
      } catch (e) {
        console.error(e);
      }
    } else {
      setOriginSuggestions([]);
    }
  };

  const handleDestChange = async (text) => {
    setDestination(text);
    setShowDestSugg(true);
    setShowOriginSugg(false);
    if (text.length > 2) {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
        const data = await res.json();
        setDestSuggestions(data);
      } catch (e) {
        console.error(e);
      }
    } else {
      setDestSuggestions([]);
    }
  };

  const selectOrigin = (item) => {
    setOrigin(item.name || item.display_name.split(",")[0]);
    setOriginCoords({ lon: item.lon, lat: item.lat });
    setShowOriginSugg(false);
  };

  const handleSwap = () => {
    const tempOrigin = origin;
    const tempOriginCoords = originCoords;
    setOrigin(destination);
    setOriginCoords(destCoords);
    setDestination(tempOrigin);
    setDestCoords(tempOriginCoords);
  };

  const fetchLiveLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setOriginCoords({ lat: latitude, lon: longitude });
          try {
            const res = await fetch(
              `https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`,
            );
            const data = await res.json();
            if (data && data.features && data.features.length > 0) {
              const props = data.features[0].properties;
              const parts = [props.name, props.city, props.state].filter(
                Boolean,
              );
              const uniqueParts = [...new Set(parts)];
              setOrigin(uniqueParts.join(", "));
            } else {
              setOrigin("Current Location");
            }
          } catch (e) {
            console.error(e);
            setOrigin("Current Location");
          }
        },
        (error) => {
          Alert.alert("Location Error", "Could not fetch current location.");
        },
      );
    } else {
      Alert.alert(
        "Not Supported",
        "Geolocation is not supported by your browser.",
      );
    }
  };

  const selectDest = (item) => {
    setDestination(item.name || item.display_name.split(",")[0]);
    setDestCoords({ lon: item.lon, lat: item.lat });
    setShowDestSugg(false);
  };

  const renderDashboardScreen = () => {
    const onSearch = async () => {
      if (!origin || !destination) {
        Alert.alert(
          "Missing Input",
          "Please specify both origin and destination.",
        );
        return;
      }
      setIsLoading(true);
      setSearchParams({ origin, destination });
      const { distanceKm, durationMin, coordinates, trafficMarkers } =
        await fetchGoogleRoute(originCoords, destCoords);
      setRouteData({ distanceKm, durationMin, coordinates, trafficMarkers });
      calculateSmartFares(
        distanceKm,
        durationMin,
        new Date().getHours(),
        passengers,
      );
      setIsLoading(false);
      navigateTo("FareMatrix");
    };

    return (
      <View style={styles.container}>
        {/* Status Bar App Header */}
        <View
          style={[styles.immersiveHeader, { zIndex: 9999, elevation: 9999 }]}
        >
          <View>
            <Text style={styles.immersiveTitle}>FARESYNC</Text>
            <Text style={styles.immersiveSubTitle}>
              Multi-Modal Pricing Engine
            </Text>
          </View>
          <View style={styles.profileRow}>
            <View style={{ alignItems: "flex-end", marginRight: 12 }}>
              <Text style={styles.profileName}>{user.name || "Traveler"}</Text>
              <Text style={styles.profileTier}>Delta Platinum</Text>
            </View>
            <TouchableOpacity
              style={[styles.profileAvatar, { zIndex: 10000 }]}
              onPress={() => signOut(auth)}
            >
              <Text style={styles.profileAvatarText}>
                {(user.name || "T")[0].toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Matrix */}
        <View
          style={[
            styles.searchMatrixBg,
            (showOriginSugg || showDestSugg) && { zIndex: 10, elevation: 10 },
          ]}
        >
          <View style={styles.searchGrid}>
            <View style={styles.timelineContainer}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineConnectingLine} />
              <View style={styles.timelineSquare} />
            </View>
            <View style={styles.inputsColumn}>
              <View
                style={[
                  styles.relativeInputOuter,
                  showOriginSugg
                    ? { zIndex: 100, elevation: 100 }
                    : { zIndex: 1, elevation: 1 },
                ]}
              >
                <Text style={styles.floatingLabel}>ORIGIN</Text>
                <View style={styles.searchBox}>
                  <TextInput
                    style={styles.immersiveSearchInput}
                    placeholder="Where from?"
                    placeholderTextColor="#888"
                    value={origin}
                    onChangeText={handleOriginChange}
                    onFocus={() => {
                      setShowDestSugg(false);
                      if (origin.length > 2) setShowOriginSugg(true);
                    }}
                  />
                  <TouchableOpacity
                    onPress={fetchLiveLocation}
                    style={{ padding: 8 }}
                  >
                    <MapPin size={20} color="#00E5FF" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                {showOriginSugg && originSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 150 }}
                    >
                      {originSuggestions.map((item, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionItem}
                          onPress={() => selectOrigin(item)}
                        >
                          <Text style={styles.suggestionText} numberOfLines={2}>
                            {item.display_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              <View style={styles.splitGapVertical} />
              <View
                style={[
                  styles.relativeInputOuter,
                  showDestSugg
                    ? { zIndex: 100, elevation: 100 }
                    : { zIndex: 1, elevation: 1 },
                ]}
              >
                <Text style={styles.floatingLabel}>DESTINATION</Text>
                <View style={styles.searchBox}>
                  <TextInput
                    style={styles.immersiveSearchInput}
                    placeholder="Where to?"
                    placeholderTextColor="#888"
                    value={destination}
                    onChangeText={handleDestChange}
                    onFocus={() => {
                      setShowOriginSugg(false);
                      if (destination.length > 2) setShowDestSugg(true);
                    }}
                  />
                </View>
                {showDestSugg && destSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 150 }}
                    >
                      {destSuggestions.map((item, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionItem}
                          onPress={() => selectDest(item)}
                        >
                          <Text style={styles.suggestionText} numberOfLines={2}>
                            {item.display_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.swapContainer}>
              <TouchableOpacity onPress={handleSwap} style={styles.swapBtn}>
                <ArrowUpDown size={16} color="#888" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quick Locations */}
        <View style={styles.quickLocationsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.quickLocationPill}
              onPress={() => {
                if (!origin) {
                  setOrigin("Connaught Place, New Delhi");
                  setOriginCoords({ lat: "28.6304", lon: "77.2177" });
                }
                setDestination("Cyber City, Gurugram");
                setDestCoords({ lat: "28.4901", lon: "77.0856" });
              }}
            >
              <Text style={styles.quickLocationText}>🏢 WORK</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickLocationPill}
              onPress={() => {
                if (!origin) {
                  setOrigin("Connaught Place, New Delhi");
                  setOriginCoords({ lat: "28.6304", lon: "77.2177" });
                }
                setDestination("IGI Airport T3, New Delhi");
                setDestCoords({ lat: "28.5562", lon: "77.1000" });
              }}
            >
              <Text style={styles.quickLocationText}>✈️ AIRPORT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickLocationPill}
              onPress={() => {
                if (!origin) {
                  setOrigin("Connaught Place, New Delhi");
                  setOriginCoords({ lat: "28.6304", lon: "77.2177" });
                }
                setDestination("Cyber Hub, New Delhi");
                setDestCoords({ lat: "28.4950", lon: "77.0878" });
              }}
            >
              <Text style={styles.quickLocationText}>☕ CAFE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickLocationPill}
              onPress={() => {
                if (!origin) {
                  setOrigin("Connaught Place, New Delhi");
                  setOriginCoords({ lat: "28.6304", lon: "77.2177" });
                }
                setDestination("Select CITYWALK, New Delhi");
                setDestCoords({ lat: "28.5284", lon: "77.2195" });
              }}
            >
              <Text style={styles.quickLocationText}>🛍️ MALL</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Passenger Config */}
        <View style={styles.passengerContainer}>
          <Text style={styles.passengerLabel}>PASSENGERS</Text>
          <View style={styles.passengerControl}>
            <TouchableOpacity
              onPress={() => setPassengers((p) => Math.max(1, p - 1))}
              style={styles.passengerBtn}
            >
              <Text style={styles.passengerBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.passengerCount}>{passengers}</Text>
            <TouchableOpacity
              onPress={() => setPassengers((p) => Math.min(6, p + 1))}
              style={styles.passengerBtn}
            >
              <Text style={styles.passengerBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {previewRoute && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewText}>
              Estimated trip: {previewRoute.distanceKm} km • ~
              {previewRoute.durationMin} mins
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.findBtn}
          onPress={onSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.findBtnText}>FIND RIDES</Text>
          )}
        </TouchableOpacity>

        {/* User Impact Dashboard */}
        <View style={styles.impactContainer}>
          <View style={styles.impactCard}>
            <Text style={styles.impactValue}>{travelHistory.length}</Text>
            <Text style={styles.impactLabel}>TOTAL RIDES</Text>
          </View>
          <View style={styles.impactCard}>
            <Text style={styles.impactValue}>
              ₹{travelHistory.reduce((sum, ride) => sum + (ride.price || 0), 0)}
            </Text>
            <Text style={styles.impactLabel}>TOTAL SPENT</Text>
          </View>
          <View style={styles.impactCard}>
            <Text style={[styles.impactValue, { color: "#10B981" }]}>
              {travelHistory
                .reduce((sum, ride) => sum + parseFloat(ride.co2 || 0), 0)
                .toFixed(1)}
              kg
            </Text>
            <Text style={styles.impactLabel}>CO₂ EMITTED</Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Bottom Nav Simulation */}
        <View style={styles.bottomNav}>
          <View style={styles.navItemGroup}>
            <View style={[styles.navDot, styles.navDotActive]} />
            <Text style={[styles.navItemText, styles.navItemTextActive]}>
              RIDES
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.navItemGroup, styles.navItemInactive]}
            onPress={() => navigateTo("History")}
          >
            <View style={styles.navDot} />
            <Text style={styles.navItemText}>HISTORY</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFareMatrixScreen = () => {
    let displayFares =
      activeFilter === "All"
        ? [...fares]
        : fares.filter((f) => f.category === activeFilter);

    displayFares.sort((a, b) => {
      // Always put non-operating at the bottom
      if (a.operating && !b.operating) return -1;
      if (!a.operating && b.operating) return 1;
      if (!a.operating && !b.operating) return 0;

      if (sortBy === "PRICE_ASC") return a.price - b.price;
      if (sortBy === "PRICE_DESC") return b.price - a.price;
      if (sortBy === "ETA_ASC") return a.eta - b.eta;
      return 0;
    });

    const renderFareCard = ({ item, index }) => {
      const isCheapest =
        index === 0 &&
        sortBy === "PRICE_ASC" &&
        activeFilter === "All" &&
        item.operating;
      return (
        <View
          style={[
            styles.fareCard,
            isCheapest
              ? styles.fareCardBest
              : item.surge
                ? styles.fareCardSurge
                : styles.fareCardNormal,
            !item.operating && { opacity: 0.6 },
          ]}
        >
          {isCheapest && (
            <View style={[styles.badge, styles.valueBadge]}>
              <Text style={styles.badgeTextBlack}>BEST VALUE</Text>
            </View>
          )}
          {item.surge && !isCheapest && item.operating && (
            <View style={[styles.badge, styles.surgeBadge]}>
              <Text style={styles.badgeTextWhite}>HIGH DEMAND</Text>
            </View>
          )}

          <View style={styles.fareRow}>
            <View style={styles.fareRowLeft}>
              <View
                style={[
                  styles.platformIconWrap,
                  {
                    backgroundColor: "#1C1C1E",
                    padding: 4,
                    borderColor: isCheapest ? "#00FF66" : "#2A2A2D",
                  },
                ]}
              >
                {item.platform === "Ola" ? (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: "#000",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "#D4EB2B",
                      }}
                    />
                  </View>
                ) : (
                  <Image
                    source={{
                      uri:
                        platformFavicons[item.platform] ||
                        "https://www.google.com/s2/favicons?domain=uber.com&sz=128",
                    }}
                    style={{ width: 44, height: 44, borderRadius: 8 }}
                    resizeMode="contain"
                    referrerPolicy="no-referrer"
                  />
                )}
              </View>
              <View style={styles.fareDetails}>
                <Text
                  style={[
                    styles.platformName,
                    isCheapest
                      ? { color: "#fff", fontSize: 16, fontWeight: "800" }
                      : { color: "#6A6A6D", fontSize: 14, fontWeight: "600" },
                  ]}
                >
                  {item.platform} {item.type}
                </Text>
                {item.operating ? (
                  <View>
                    <Text
                      style={[
                        styles.etaText,
                        !isCheapest && { color: "#4E4E52" },
                      ]}
                    >
                      {item.eta} min away • {item.duration} min (
                      {routeData.distanceKm}km)
                    </Text>
                    {item.co2 > 0 ? (
                      <Text
                        style={[
                          styles.co2Text,
                          !isCheapest && { color: "#3A4E3E", opacity: 0.7 },
                        ]}
                      >
                        ~{item.co2} kg CO₂
                      </Text>
                    ) : (
                      <Text
                        style={[
                          styles.co2TextZ,
                          !isCheapest && { opacity: 0.5 },
                        ]}
                      >
                        Zero Emissions 🌱
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.etaText}>
                    Not available in {origin.split(",")[0]}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.priceContainer}>
              {item.operating ? (
                <>
                  <PulsingPrice
                    price={item.price}
                    isSurge={item.surge}
                    isCheapest={isCheapest}
                    style={styles.priceText}
                  />
                  <TouchableOpacity
                    style={[
                      styles.bookBtn,
                      isCheapest
                        ? styles.btnBest
                        : item.surge
                          ? styles.btnSurge
                          : styles.btnNormal,
                    ]}
                    onPress={() => handleBookRide(item)}
                  >
                    <Text
                      style={[
                        styles.bookBtnText,
                        isCheapest
                          ? styles.btnTextBest
                          : item.surge
                            ? styles.btnTextSurge
                            : styles.btnTextNormal,
                      ]}
                    >
                      BOOK
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text
                  style={[styles.priceText, { color: "#888", fontSize: 14 }]}
                >
                  Not Operating
                </Text>
              )}
            </View>
          </View>
        </View>
      );
    };

    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigateTo("Dashboard")}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>{"< BACK"}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.topBarTitle}>SELECT A RIDE</Text>
            <Text style={styles.topBarSub}>
              {routeData.distanceKm} KM • ~{routeData.durationMin} MINS
            </Text>
          </View>
        </View>

        <FlatList
          style={{ flex: 1 }}
          data={displayFares}
          keyExtractor={(item) => item.id}
          renderItem={renderFareCard}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {originCoords && destCoords && (
                <View style={styles.mapContainer}>
                  {Platform.OS === "web" ? (
                    <WebMap
                      originCoords={originCoords}
                      destCoords={destCoords}
                      routeCoordinates={routeData?.coordinates || null}
                      trafficMarkers={routeData?.trafficMarkers || []}
                    />
                  ) : (
                    <MapView
                      style={styles.mapViewProps}
                      initialRegion={{
                        latitude:
                          (parseFloat(originCoords.lat) +
                            parseFloat(destCoords.lat)) /
                          2,
                        longitude:
                          (parseFloat(originCoords.lon) +
                            parseFloat(destCoords.lon)) /
                          2,
                        latitudeDelta:
                          Math.abs(
                            parseFloat(originCoords.lat) -
                              parseFloat(destCoords.lat),
                          ) * 1.5 || 0.05,
                        longitudeDelta:
                          Math.abs(
                            parseFloat(originCoords.lon) -
                              parseFloat(destCoords.lon),
                          ) * 1.5 || 0.05,
                      }}
                    >
                      <Marker
                        coordinate={{
                          latitude: parseFloat(originCoords.lat),
                          longitude: parseFloat(originCoords.lon),
                        }}
                        title="Origin"
                      />
                      <Marker
                        coordinate={{
                          latitude: parseFloat(destCoords.lat),
                          longitude: parseFloat(destCoords.lon),
                        }}
                        title="Destination"
                      />
                      <Polyline
                        coordinates={
                          routeData?.coordinates
                            ? routeData.coordinates.map((c) => ({
                                latitude: parseFloat(c.lat),
                                longitude: parseFloat(c.lon),
                              }))
                            : [
                                {
                                  latitude: parseFloat(originCoords.lat),
                                  longitude: parseFloat(originCoords.lon),
                                },
                                {
                                  latitude: parseFloat(destCoords.lat),
                                  longitude: parseFloat(destCoords.lon),
                                },
                              ]
                        }
                        strokeColor="#FF2E93"
                        strokeWidth={3}
                      />
                      {routeData?.trafficMarkers &&
                        routeData.trafficMarkers.map((marker, index) => (
                          <Marker
                            key={`traffic-${index}`}
                            coordinate={{
                              latitude: parseFloat(marker.lat),
                              longitude: parseFloat(marker.lon),
                            }}
                            pinColor={
                              marker.severity === "heavy" ? "red" : "orange"
                            }
                          />
                        ))}
                    </MapView>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  backgroundColor: "#161618",
                  borderBottomWidth: 1,
                  borderBottomColor: "#2A2A2D",
                }}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setShowFilters(!showFilters);
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Filter color="#00E5FF" size={16} />
                  <Text
                    style={{
                      marginLeft: 8,
                      color: "#00E5FF",
                      fontWeight: "700",
                      fontSize: 13,
                      letterSpacing: 1,
                    }}
                  >
                    {showFilters
                      ? "HIDE FILTERS & SORT"
                      : "SHOW FILTERS & SORT"}
                  </Text>
                </View>
                {showFilters ? (
                  <ChevronUp color="#00E5FF" size={20} />
                ) : (
                  <ChevronDown color="#00E5FF" size={20} />
                )}
              </TouchableOpacity>

              {showFilters && (
                <View style={{ paddingBottom: 16 }}>
                  <View style={styles.filterWrap}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {["All", "Bikes", "Autos", "Cabs", "SUVs"].map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => {
                            LayoutAnimation.configureNext(
                              LayoutAnimation.Presets.easeInEaseOut,
                            );
                            setActiveFilter(cat);
                          }}
                          style={[
                            styles.filterCapsule,
                            activeFilter === cat && styles.activeCapsule,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterText,
                              activeFilter === cat && styles.activeFilterText,
                            ]}
                          >
                            {cat.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.sortWrap}>
                    <Text style={styles.sortLabel}>SORT BY:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {[
                        { id: "PRICE_ASC", label: "Price", icon: "ASC" },
                        { id: "PRICE_DESC", label: "Price", icon: "DESC" },
                        { id: "ETA_ASC", label: "ETA", icon: "ASC" },
                      ].map((sortOpt) => (
                        <TouchableOpacity
                          key={sortOpt.id}
                          onPress={() => {
                            LayoutAnimation.configureNext(
                              LayoutAnimation.Presets.easeInEaseOut,
                            );
                            setSortBy(sortOpt.id);
                          }}
                          style={[
                            styles.sortCapsule,
                            sortBy === sortOpt.id && styles.activeSortCapsule,
                            { flexDirection: "row", alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.sortText,
                              sortBy === sortOpt.id && styles.activeSortText,
                            ]}
                          >
                            {sortOpt.label}
                          </Text>
                          {sortBy === sortOpt.id && (
                            <View style={{ marginLeft: 4 }}>
                              {sortOpt.icon === "ASC" ? (
                                <ChevronDown size={14} color="#000" />
                              ) : (
                                <ChevronUp size={14} color="#000" />
                              )}
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}

              {displayFares.filter((f) => f.operating).length > 0 && (
                <View style={styles.disclaimerWrap}>
                  <Text style={styles.disclaimerText}>
                    Note: These prices are rough estimates based on average
                    market data. Actual platform fares may vary due to real-time
                    driver availability and surge pricing.
                  </Text>
                </View>
              )}

              {displayFares.filter((f) => f.operating).length > 0 && (
                <View
                  style={{
                    height: 180,
                    marginHorizontal: 24,
                    marginTop: 10,
                    marginBottom: 10,
                    backgroundColor: "#161618",
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#2A2A2D",
                  }}
                >
                  <Text
                    style={{
                      color: "#888",
                      fontSize: 10,
                      fontWeight: "700",
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    PRICE COMPARISON
                  </Text>
                  <View style={{ flex: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={displayFares
                          .filter((f) => f.operating)
                          .slice(0, 5)
                          .sort((a, b) => a.price - b.price)}
                        margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="platform"
                          type="category"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#bbb", fontSize: 11 }}
                          width={80}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1E1E1E",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "#fff",
                          }}
                          itemStyle={{ color: "#00E5FF" }}
                          formatter={(value) => [`₹${value}`, "Price"]}
                        />
                        <Bar dataKey="price" radius={[0, 4, 4, 0]} barSize={12}>
                          {displayFares
                            .filter((f) => f.operating)
                            .slice(0, 5)
                            .sort((a, b) => a.price - b.price)
                            .map((entry, index) => {
                              const fill =
                                entry.platform === "Uber"
                                  ? "#fff"
                                  : entry.platform === "Ola"
                                    ? "#FDE047"
                                    : entry.platform === "Rapido"
                                      ? "#00FF66"
                                      : "#FF2E93";
                              return <Cell key={`cell-${index}`} fill={fill} />;
                            })}
                          <LabelList
                            dataKey="price"
                            position="right"
                            fill="#fff"
                            fontSize={11}
                            formatter={(v: number) => `₹${v}`}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </View>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No rides available in this category.
            </Text>
          }
        />
      </View>
    );
  };

  const renderHistoryScreen = () => {
    const renderHistoryItem = ({ item }) => (
      <View style={styles.historyCard}>
        <View style={styles.historyTopRow}>
          <Text style={styles.historyDate}>
            {new Date(item.date).toLocaleString()}
          </Text>
          <Text style={styles.historyPrice}>₹{item.price}</Text>
        </View>
        <Text style={styles.historyRoute} numberOfLines={1}>
          ↑ {item.origin}
        </Text>
        <Text style={styles.historyRoute} numberOfLines={1}>
          ↓ {item.dest}
        </Text>
        <Text style={styles.historyPlatform}>
          {item.platform} {item.serviceName}
        </Text>
      </View>
    );

    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigateTo("Dashboard")}
            style={styles.backBtn}
          >
            <ChevronLeft color="#00E5FF" size={24} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Travel History</Text>
        </View>

        <FlatList
          data={travelHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No past rides found.</Text>
            </View>
          }
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />
      {!user.uid ? (
        renderAuthScreen()
      ) : (
        <>
          {currentScreen === "Dashboard" ? renderDashboardScreen() : null}
          {currentScreen === "FareMatrix" ? renderFareMatrixScreen() : null}
          {currentScreen === "History" ? renderHistoryScreen() : null}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  container: {
    flex: 1,
    backgroundColor: "#050505",
    overflow: "hidden",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#050505",
    justifyContent: "center",
    padding: 20,
  },
  brandTitle: {
    fontSize: 40,
    fontWeight: "800",
    color: "#00E5FF",
    textAlign: "center",
    marginBottom: 40,
    letterSpacing: -1,
  },
  authInput: {
    backgroundColor: "#1E1E1E",
    borderColor: "#333",
    borderWidth: 1,
    borderRadius: 8,
    color: "#FFF",
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
    fontSize: 14,
  },
  secondaryBtn: {
    backgroundColor: "transparent",
    borderColor: "#333",
    borderWidth: 1,
    borderRadius: 8,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  authCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#161618",
    padding: 24,
    borderRadius: 16,
    borderColor: "#2A2A2D",
    borderWidth: 1,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  authSubtitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#050505",
    color: "#fff",
    borderColor: "#2A2A2D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: "#00E5FF",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    elevation: 5,
    shadowColor: "#00E5FF",
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  primaryBtnText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  authToggleBtn: {
    marginTop: 16,
    alignItems: "center",
  },
  authToggleText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
  },

  immersiveHeader: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2D",
  },
  immersiveTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#00E5FF",
    fontStyle: "italic",
  },
  immersiveSubTitle: {
    fontSize: 9,
    color: "rgba(0, 229, 255, 0.6)",
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  profileTier: {
    fontSize: 9,
    color: "#00FF66",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#00E5FF",
    backgroundColor: "#161618",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },

  searchMatrixBg: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: "rgba(22, 22, 24, 0.5)",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2D",
  },
  searchGrid: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  timelineContainer: {
    width: 24,
    alignItems: "center",
    paddingVertical: 18,
    marginRight: 12,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00E5FF",
    marginTop: 8,
  },
  timelineConnectingLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#2A2A2D",
    marginVertical: 4,
  },
  timelineSquare: {
    width: 8,
    height: 8,
    backgroundColor: "#FF2E93",
    marginBottom: 8,
  },
  inputsColumn: {
    flex: 1,
  },
  swapContainer: {
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2A2A2D",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3F3F42",
  },
  quickLocationsRow: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
  },
  quickLocationPill: {
    backgroundColor: "#1E1E1E",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#2A2A2D",
  },
  quickLocationText: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "600",
  },
  impactContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 24,
    marginTop: 32,
    backgroundColor: "#161618",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2D",
  },
  impactCard: {
    alignItems: "center",
    flex: 1,
  },
  impactValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  impactLabel: {
    color: "#888",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  passengerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#161618",
    marginHorizontal: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#2A2A2D",
  },
  passengerLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  passengerControl: {
    flexDirection: "row",
    alignItems: "center",
  },
  passengerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2A2A2D",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: -2,
  },
  passengerCount: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 16,
  },
  splitGapVertical: {
    height: 16,
  },
  relativeInputOuter: {
    flex: 1,
    position: "relative",
    marginTop: 8, // Give space for floating label
  },
  splitGap: {
    width: 16,
  },
  floatingLabel: {
    position: "absolute",
    top: -8,
    left: 12,
    backgroundColor: "#050505",
    paddingHorizontal: 8,
    zIndex: 1,
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161618",
    borderColor: "#2A2A2D",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  inputDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  immersiveSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  suggestionsContainer: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: "#161618",
    borderWidth: 1,
    borderColor: "#2A2A2D",
    borderRadius: 8,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 5,
    overflow: "hidden",
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2D",
  },
  suggestionText: {
    color: "#D1D5DB",
    fontSize: 12,
  },

  findBtn: {
    backgroundColor: "#00E5FF",
    marginHorizontal: 24,
    marginTop: 32,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#00E5FF",
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  findBtnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  previewContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: "center",
  },
  previewText: {
    color: "#00E5FF",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  bottomNav: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2D",
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#050505",
  },
  navItemGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  navItemInactive: {
    opacity: 0.4,
  },
  navDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "transparent",
    marginBottom: 4,
  },
  navDotActive: {
    backgroundColor: "#00E5FF",
    shadowColor: "#00E5FF",
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  navItemText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  navItemTextActive: {
    color: "#00E5FF",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161618",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2D",
  },
  backBtn: {
    marginRight: 16,
  },
  backBtnText: {
    color: "#00E5FF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  topBarTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  topBarSub: {
    color: "#888",
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 1,
  },
  mapContainer: {
    height: 200,
    width: "100%",
    backgroundColor: "#1E1E1E",
    overflow: "hidden",
    position: "relative",
  },
  mapViewProps: {
    flex: 1,
    height: "100%",
    width: "100%",
  },
  smartWaitBanner: {
    backgroundColor: "#1E0C33",
    padding: 16,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  smartWaitLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },
  smartWaitIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  smartWaitTitle: {
    color: "#E9D5FF",
    fontWeight: "700",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  smartWaitText: {
    color: "rgba(216, 180, 254, 0.8)",
    fontSize: 10,
  },
  activateBtn: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activateBtnText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  filterWrap: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  sortWrap: {
    paddingBottom: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  sortLabel: {
    color: "#666",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginRight: 12,
  },
  sortCapsule: {
    backgroundColor: "#1E1E1E",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#2A2A2D",
  },
  activeSortCapsule: {
    backgroundColor: "#333",
    borderColor: "#555",
  },
  sortText: {
    color: "#888",
    fontSize: 11,
    fontWeight: "600",
  },
  activeSortText: {
    color: "#fff",
  },
  promoWrap: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#3F3F42",
    borderRadius: 8,
    backgroundColor: "#1E1E1E",
  },
  promoInput: {
    flex: 1,
    color: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  promoBtn: {
    backgroundColor: "#333",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  promoBtnApplied: {
    backgroundColor: "#10B981",
  },
  promoBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
  disclaimerWrap: {
    marginHorizontal: 24,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  disclaimerText: {
    color: "#888",
    fontSize: 11,
    fontStyle: "italic",
    lineHeight: 16,
    textAlign: "center",
  },
  filterCapsule: {
    backgroundColor: "transparent",
    borderColor: "#2A2A2D",
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 12,
  },
  activeCapsule: {
    backgroundColor: "#00E5FF",
    borderColor: "#00E5FF",
  },
  filterText: {
    color: "#9CA3AF",
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  activeFilterText: {
    color: "#000",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  fareCard: {
    backgroundColor: "#161618",
    borderColor: "#2A2A2D",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    position: "relative",
  },
  fareCardBest: {
    borderColor: "rgba(0, 255, 102, 0.5)",
  },
  fareCardSurge: {
    borderColor: "#2A2A2D",
  },
  fareCardNormal: {
    opacity: 0.8,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    zIndex: 10,
  },
  valueBadge: {
    backgroundColor: "#00FF66",
  },
  surgeBadge: {
    backgroundColor: "#FF2E93",
  },
  badgeTextBlack: {
    color: "#000",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  badgeTextWhite: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fareRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  platformIconWrap: {
    width: 56,
    height: 56,
    backgroundColor: "#050505",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2D",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  platformIconText: {
    fontSize: 10,
    fontWeight: "700",
    fontStyle: "italic",
  },
  fareDetails: {
    flex: 1,
    justifyContent: "center",
  },
  platformName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  etaText: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  co2Text: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  co2TextZ: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  priceContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  priceText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
  },
  bookBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnBest: {
    backgroundColor: "#00FF66",
    borderColor: "#00FF66",
  },
  btnSurge: {
    backgroundColor: "#161618",
    borderColor: "#2A2A2D",
  },
  btnNormal: {
    backgroundColor: "transparent",
    borderColor: "#2A2A2D",
  },
  bookBtnText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  btnTextBest: {
    color: "#000",
  },
  btnTextSurge: {
    color: "#00E5FF",
  },
  btnTextNormal: {
    color: "#9CA3AF",
  },
  emptyText: {
    color: "#888",
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
  emptyWrap: {
    alignItems: "center",
    marginTop: 40,
  },
  historyCard: {
    backgroundColor: "#161618",
    borderColor: "#2A2A2D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  historyDate: {
    color: "#888",
    fontSize: 12,
  },
  historyPrice: {
    color: "#fff",
    fontWeight: "800",
  },
  historyRoute: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 4,
  },
  historyPlatform: {
    color: "#00E5FF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  authLogoContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 40,
  },
  deckLogoStack: {
    width: 60,
    height: 28,
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
  },
  deckLogoLayer: {
    height: 4,
    width: "100%",
    backgroundColor: "#00E5FF",
    borderRadius: 2,
    position: "absolute",
    ...Platform.select({
      web: {
        boxShadow: "0px 0px 8px #00E5FF",
      },
      default: {
        shadowColor: "#00E5FF",
        shadowOpacity: 0.6,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },
  deckBrandTitle: {
    fontSize: 48,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 4,
    textAlign: "center",
  },
  deckBrandSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8E8E93",
    letterSpacing: 1,
    marginTop: 6,
    textTransform: "uppercase",
  },
  authCardDescription: {
    color: "#8E8E93",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 24,
  },
  authErrorContainer: {
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.3)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  authErrorText: {
    color: "#FF4444",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  authFooterContainer: {
    marginTop: 48,
    alignItems: "center",
  },
  authFooterText: {
    fontSize: 9,
    color: "#48484A",
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  dataStorageInfo: {
    marginTop: 32,
    paddingHorizontal: 24,
    maxWidth: 400,
    alignItems: "center",
  },
  dataStorageTitle: {
    color: "#6A6A6D",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  dataStorageText: {
    color: "#4E4E52",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});
