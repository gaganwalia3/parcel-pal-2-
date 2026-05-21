import { createContext, useContext, useEffect, useState } from "react";

// Mock User type to match what the app expects
export interface User {
  id: string;
  email: string;
  role?: string;
  full_name?: string;
  vehicle_info?: {
    type: string;
    model: string;
    plate: string;
  };
  home_location?: {
    display_name: string;
    lat: number;
    lon: number;
  } | string;
  saved_locations?: Array<{
    id: string;
    label: string;
    display_name: string;
    lat: number;
    lon: number;
  }>;
  user_metadata: {
    role?: string;
    full_name?: string;
    vehicle_info?: {
      type: string;
      model: string;
      plate: string;
    };
    home_location?: {
      display_name: string;
      lat: number;
      lon: number;
    } | string;
    saved_locations?: Array<{
      id: string;
      label: string;
      display_name: string;
      lat: number;
      lon: number;
    }>;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDriver: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  updateSession: (user: User, token: string) => void;
  refreshProfile: (tokenOverride?: string) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDriver, setIsDriver] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 1. Get initial session from localStorage
    const token = localStorage.getItem("pp_token");
    const storedUserStr = localStorage.getItem("pp_user");
    
    if (token && storedUserStr) {
      try {
        const storedUser = JSON.parse(storedUserStr);
        handleUserChange(storedUser);
      } catch (e) {
        handleUserChange(null);
      }
    } else {
      handleUserChange(null);
    }
    setLoading(false);
  }, []);

  const handleUserChange = (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      // Extract the role from user_metadata or root
      const role = newUser.role || newUser.user_metadata?.role;
      setIsDriver(role === "driver");
      setIsAdmin(role === "admin");
    } else {
      setIsDriver(false);
      setIsAdmin(false);
    }
  };

  const refreshProfile = async (tokenOverride?: string): Promise<User | null> => {
    const token = tokenOverride || localStorage.getItem("pp_token");
    if (!token) return null;

    try {
      const res = await fetch("http://localhost:3001/api/auth/profile", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to fetch profile");
      }
      const dbUser = await res.json();
      
      const updatedUser: User = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        full_name: dbUser.full_name,
        vehicle_info: dbUser.vehicle_info,
        home_location: dbUser.home_location,
        saved_locations: dbUser.saved_locations,
        user_metadata: {
          role: dbUser.role,
          full_name: dbUser.full_name,
          vehicle_info: dbUser.vehicle_info,
          home_location: dbUser.home_location,
          saved_locations: dbUser.saved_locations,
        }
      };

      localStorage.setItem("pp_user", JSON.stringify(updatedUser));
      const role = updatedUser.role || updatedUser.user_metadata?.role;
      if (role === "driver") {
        localStorage.setItem("pp_driver_user", JSON.stringify(updatedUser));
      } else {
        localStorage.setItem("pp_customer_user", JSON.stringify(updatedUser));
      }

      handleUserChange(updatedUser);
      return updatedUser;
    } catch (err) {
      console.error("refreshProfile error:", err);
      return null;
    }
  };

  const updateSession = (newUser: User, token: string) => {
    localStorage.setItem("pp_token", token);
    
    const role = newUser.role || newUser.user_metadata?.role;
    const formattedUser: User = {
      ...newUser,
      role: role,
      user_metadata: {
        ...newUser.user_metadata,
        role: role,
      }
    };

    localStorage.setItem("pp_user", JSON.stringify(formattedUser));
    
    if (role === "driver") {
      localStorage.setItem("pp_driver_token", token);
      localStorage.setItem("pp_driver_user", JSON.stringify(formattedUser));
    } else {
      localStorage.setItem("pp_customer_token", token);
      localStorage.setItem("pp_customer_user", JSON.stringify(formattedUser));
    }
    
    handleUserChange(formattedUser);
  };

  const signOut = async () => {
    localStorage.removeItem("pp_token");
    localStorage.removeItem("pp_user");
    localStorage.removeItem("pp_driver_token");
    localStorage.removeItem("pp_driver_user");
    localStorage.removeItem("pp_customer_token");
    localStorage.removeItem("pp_customer_user");
    handleUserChange(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isDriver, isAdmin, signOut, updateSession, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};