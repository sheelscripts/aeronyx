"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, X, AlertTriangle, AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import { fetchAlerts, clearAlerts } from "../services/api";
import Link from "next/link";

interface AlertItem {
  alert_id: string;
  severity: "critical" | "warning" | "info";
  zone: string;
  timestamp: string;
  message: string;
}

function SeverityIcon({ severity, size = 14 }: { severity: string; size?: number }) {
  if (severity === "critical") return <AlertCircle size={size} color="#ef4444" />;
  if (severity === "warning") return <AlertTriangle size={size} color="#f97316" />;
  return <CheckCircle size={size} color="#22c55e" />;
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const loadAlerts = async () => {
    try {
      const data = await fetchAlerts(20);
      const list = data.alerts || [];
      setAlerts(list);
      if (list.length > prevCountRef.current) {
        setUnread((u) => u + (list.length - prevCountRef.current));
      }
      prevCountRef.current = list.length;
    } catch (_) {}
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen((o) => !o);
    setUnread(0);
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await clearAlerts();
      setAlerts([]);
      prevCountRef.current = 0;
    } catch (_) {}
    setLoading(false);
  };

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="sidebar-bell-btn"
        title="Alerts"
      >
        <Bell size={17} color="currentColor" />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              background: "#ef4444",
              color: "#fff",
              fontSize: "0.58rem",
              fontWeight: 800,
              width: 15,
              height: 15,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              border: "1.5px solid #001e2b",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="notification-dropdown">
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px 12px",
              borderBottom: "1px solid rgba(16,185,129,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={16} color="#065f46" />
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#064e3b" }}>Alerts</span>
              {criticalCount > 0 && (
                <span
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    color: "#ef4444",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 8,
                  }}
                >
                  {criticalCount} critical
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {alerts.length > 0 && (
                <button
                  onClick={handleClear}
                  disabled={loading}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                    padding: 4,
                    borderRadius: 6,
                  }}
                  title="Clear all"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {alerts.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "0.85rem",
                }}
              >
                <CheckCircle size={28} color="#d1fae5" style={{ marginBottom: 8 }} />
                <div>No active alerts</div>
                <div style={{ fontSize: "0.75rem", marginTop: 4, color: "#d1d5db" }}>All zones within thresholds</div>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.alert_id}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(16,185,129,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <SeverityIcon severity={alert.severity} size={15} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.8rem",
                            color: alert.severity === "critical" ? "#ef4444" : "#f97316",
                          }}
                        >
                          {alert.zone}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "#9ca3af", whiteSpace: "nowrap", marginLeft: 8 }}>
                          {timeAgo(alert.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2, lineHeight: 1.4 }}>
                        {alert.message}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid rgba(16,185,129,0.08)",
              background: "rgba(16,185,129,0.04)",
            }}
          >
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              style={{
                fontSize: "0.78rem",
                color: "#065f46",
                fontWeight: 600,
                textDecoration: "none",
                display: "block",
                textAlign: "center",
              }}
            >
              View all alerts & manage rules →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
