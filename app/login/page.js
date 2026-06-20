"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, Store } from "lucide-react";

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      // Keep email, only clear password and show error
      setPassword("");
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background Animation */}
      <div style={styles.bgAnimation}>
        <div style={styles.circle1}></div>
        <div style={styles.circle2}></div>
        <div style={styles.circle3}></div>
      </div>

      <div style={styles.loginBox}>
        {/* Logo/Icon */}
       <div style={styles.iconContainer}>
  <img 
    src="/Aranlogo.png" 
    alt="Aran Med Store" 
    style={{
      width: "400px",
      height: "auto",
      objectFit: "contain",
      display: "block",
    }}
  />
</div>

        {/* <h1 style={styles.title}>Aran Med Store</h1> */}
        
        <p style={styles.subtitle}></p>

        {error && (
          <div style={styles.errorContainer}>
            <div style={styles.errorIcon}>⚠️</div>
            <div style={styles.errorMessage}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Email Field */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <div style={styles.inputWrapper}>
              <Mail size={20} style={styles.inputIcon} color="#9ca3af" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={20} style={styles.inputIcon} color="#9ca3af" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#9ca3af" />
                ) : (
                  <Eye size={20} color="#9ca3af" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? (
              <span style={styles.loadingText}>
                <span style={styles.spinner}></span>
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            © {new Date().getFullYear()} Aran Med Store. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    position: "relative",
    overflow: "hidden",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  // Background Animation
  bgAnimation: {
    position: "absolute",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.05)",
    top: "-100px",
    right: "-100px",
    animation: "float 20s ease-in-out infinite",
  },
  circle2: {
    position: "absolute",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.05)",
    bottom: "-50px",
    left: "-50px",
    animation: "float 25s ease-in-out infinite reverse",
  },
  circle3: {
    position: "absolute",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.08)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    animation: "pulse 15s ease-in-out infinite",
  },
  loginBox: {
    background: "rgba(255, 255, 255, 1)",
    backdropFilter: "blur(10px)",
    padding: "48px 40px",
    borderRadius: "20px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
    width: "100%",
    maxWidth: "420px",
    zIndex: 10,
    position: "relative",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },
  iconContainer: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    boxShadow: "0 10px 30px rgba(102, 126, 234, 0.3)",
  },
  title: {
    textAlign: "center",
    color: "#1a1a2e",
    margin: "0 0 8px 0",
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    textAlign: "center",
    color: "#6b7280",
    margin: "0 0 32px 0",
    fontSize: "15px",
    fontWeight: "400",
  },
  errorContainer: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    animation: "shake 0.5s ease-in-out",
  },
  errorIcon: {
    fontSize: "20px",
    flexShrink: 0,
  },
  errorMessage: {
    color: "#dc2626",
    fontSize: "14px",
    fontWeight: "500",
    flex: 1,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    color: "#374151",
    fontWeight: "600",
    fontSize: "14px",
    letterSpacing: "0.3px",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "14px",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "12px 14px 12px 44px",
    border: "2px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "15px",
    transition: "all 0.3s ease",
    outline: "none",
    backgroundColor: "#fafafa",
    color: "#1a1a2e",
    fontFamily: "inherit",
    "&:focus": {
      borderColor: "#667eea",
      boxShadow: "0 0 0 4px rgba(102, 126, 234, 0.1)",
      backgroundColor: "#ffffff",
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "not-allowed",
    },
  },
  eyeButton: {
    position: "absolute",
    right: "14px",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    "&:hover": {
      opacity: 0.7,
    },
    "&:disabled": {
      opacity: 0.4,
      cursor: "not-allowed",
    },
  },
  button: {
    padding: "14px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    marginTop: "8px",
    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
    letterSpacing: "0.5px",
    position: "relative",
    overflow: "hidden",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 8px 25px rgba(102, 126, 234, 0.5)",
    },
    "&:active": {
      transform: "translateY(0)",
    },
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
    transform: "none !important",
  },
  loadingText: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
  },
  spinner: {
    display: "inline-block",
    width: "20px",
    height: "20px",
    border: "3px solid rgba(255, 255, 255, 0.3)",
    borderTop: "3px solid #ffffff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  footer: {
    marginTop: "24px",
    textAlign: "center",
  },
  footerText: {
    color: "#9ca3af",
    fontSize: "13px",
    margin: 0,
  },
};

// Add CSS animations to your globals.css or in a style tag
const animations = `
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-30px) rotate(5deg); }
}

@keyframes pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.5; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// Add the styles to the document head if not using CSS modules
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = animations;
  document.head.appendChild(style);
}