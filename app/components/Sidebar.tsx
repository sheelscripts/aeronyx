"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  Shield,
  FileText,
  Wind,
  Menu,
  X,
  Activity,
  Map,
  Brain,
  Bell,
  Factory,
} from "lucide-react";
import { useLiveData } from "../hooks/useData";
import NotificationBell from "./NotificationBell";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/map", label: "Ward Map", icon: Map },
  { path: "/wind", label: "Wind Analysis", icon: Wind },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/ml", label: "ML Insights", icon: Brain },
  { path: "/plume", label: "Plume Map", icon: Factory },
  { path: "/alerts", label: "Alerts", icon: Bell },
  { path: "/advisory", label: "Health Advisory", icon: Shield },
  { path: "/admin", label: "Admin Panel", icon: FileText },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data } = useLiveData();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLive = mounted && !!data;

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid rgba(0,30,43,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
            }}
          >
            <Wind size={15} color="var(--brand-teal-deep)" />
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Aeronyx
          </span>
        </div>
        <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`} style={{ background: "var(--brand-teal-deep)" }}>
        {/* Logo + notification bell */}
        <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Custom Luxury Logo Emblem */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <Wind size={18} color="var(--primary)" />
              <div
                style={{
                  position: "absolute",
                  inset: -2,
                  borderRadius: "50%",
                  border: "1px solid rgba(0,237,100,0.12)",
                  pointerEvents: "none",
                }}
              />
            </div>
            <div className="sidebar-logo-text">
              <h1 style={{ color: "#ffffff", fontSize: "1.25rem", letterSpacing: "-0.02em", fontWeight: 700 }}>Aeronyx</h1>
              <span style={{ color: "var(--on-dark-muted)", fontSize: "0.62rem", letterSpacing: "0.08em", fontWeight: 700 }}>Atmos Intel</span>
            </div>
          </div>
          <NotificationBell />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" style={{ position: "relative" }}>
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                className={`nav-link ${isActive ? "active" : ""}`}
                style={{
                  position: "relative",
                  color: isActive ? "var(--primary)" : "var(--on-dark-muted)",
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                  fontWeight: isActive ? 600 : 500,
                  transition: "color 0.2s ease",
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                }}
                onClick={() => setMobileOpen(false)}
              >
                {/* Active link sliding background indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeSidebarNav"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(255, 255, 255, 0.05)",
                      borderLeft: "2.5px solid var(--primary)",
                      borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                      zIndex: -1,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 30,
                    }}
                  />
                )}
                
                <Icon size={16} style={{ color: isActive ? "var(--primary)" : "rgba(255, 255, 255, 0.45)", transition: "color 0.2s ease" }} />
                <span style={{ fontSize: "0.85rem" }}>{label}</span>
                
                {/* Tiny active status dot */}
                {isActive && (
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--primary)",
                      marginLeft: "auto",
                      boxShadow: "0 0 6px var(--primary)",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Luxury Telemetry Status Panel */}
        <div
          className="sidebar-status"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "var(--radius-lg)",
            padding: "16px",
            marginTop: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span
              className={`status-dot ${isLive ? "" : "offline"}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isLive ? "var(--primary)" : "var(--muted)",
                boxShadow: isLive ? "0 0 8px var(--primary)" : "none",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: isLive ? "var(--primary)" : "var(--on-dark-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {isLive ? "Telemetry Active" : "Connecting..."}
            </span>
          </div>

          {isLive && data ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#ffffff",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Activity size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
                <span>AQI {data.aqi} · {data.aqi_category}</span>
              </div>
              <div
                style={{
                  fontSize: "0.62rem",
                  color: "rgba(255, 255, 255, 0.35)",
                  letterSpacing: "0.04em",
                  marginTop: 2,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>NODE: WARD_01</span>
                <span>FEED: CLOUD_IoT</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "0.68rem", color: "rgba(255, 255, 255, 0.35)" }}>
              Polling connection pipeline...
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,30,43,0.35)",
            zIndex: 99,
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />
      )}
    </>
  );
}
