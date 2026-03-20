// js/core/config.js
const DEFAULTS = {
  // API endpoints (retained for backward compatibility, but Supabase will be used primarily)
  API_BASE_URL: 'https://api.mabunplay.com/v1',
  WS_BASE_URL: 'wss://ws.mabunplay.com',

  // Supabase credentials (these should be overridden via window.__APP_CONFIG__ or environment variables)
  SUPABASE_URL: 'https://iarjbnklktgcetfpayks.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhcmpibmtsa3RnY2V0ZnBheWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODQ2MjAsImV4cCI6MjA4OTU2MDYyMH0.4ZS3espzqXETxwJDxFTs5mP1p2PP21B0cfQ3L8W24S8',

  // Feature flags
  ENABLE_PAYMENTS: false,          // Payment gateway integration
  USE_MOCK_DATA: false,           // If true, use local mock data instead of real API calls

  // Business rules
  MIN_DEPOSIT: 5000,              // Minimum deposit in SSP
  MAX_WALLET: 50000000,           // Maximum wallet balance
  WITHDRAWAL_FEE: 0.01,           // 1% fee
  QUIZ_ENTRY_FEES: {
    hourly: 1000,
    daily: 2000,
    weekly: 3000,
    auto: 15000
  },
  SUPPORTED_PROVIDERS: ['mtn', 'digitel'],
  OTP_LENGTH: 6,
  OTP_EXPIRY_SECONDS: 120,

  // Other settings
  LOW_BALANCE_THRESHOLD: 5000,    // Trigger low balance warning
  MAX_WITHDRAWAL_DAILY: 500000,   // SSP per day
  MAX_DEPOSIT_DAILY: 500000,      // SSP per day
};

// Merge with runtime config if present (e.g., injected by Cloudflare Pages)
const config = window.__APP_CONFIG__ ? { ...DEFAULTS, ...window.__APP_CONFIG__ } : DEFAULTS;

export default config;