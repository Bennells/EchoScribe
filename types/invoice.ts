import { Timestamp } from "firebase/firestore";

/**
 * Invoice document stored in Firestore
 * Tracks Stripe invoices for subscriptions
 */
export interface Invoice {
  // Stripe identifiers
  invoiceId: string; // Stripe invoice ID
  invoiceNumber: string | null; // Sequential invoice number from Stripe
  subscriptionId: string; // Associated subscription ID
  customerId: string; // Stripe customer ID
  userId?: string; // Firebase user ID (optional, derived from subscription)

  // Financial details
  amountDue: number; // Amount due in cents
  total: number; // Total amount including tax in cents
  tax: number; // Tax amount in cents
  subtotal: number; // Subtotal before tax in cents
  currency: string; // Currency code (e.g., "eur")

  // Invoice status
  status: "draft" | "open" | "paid" | "void" | "uncollectible" | "finalized";

  // URLs for access
  invoicePdf: string | null; // URL to PDF invoice
  hostedInvoiceUrl: string | null; // URL to Stripe-hosted invoice page

  // Timestamps
  createdAt: Timestamp; // When invoice was created
  finalizedAt?: Timestamp; // When invoice was finalized (ready for payment)
  paidAt?: Timestamp; // When invoice was paid
  updatedAt?: Timestamp; // Last update timestamp
}

/**
 * Client-side invoice type (uses Date instead of Timestamp)
 */
export interface InvoiceData {
  invoiceId: string;
  invoiceNumber: string | null;
  subscriptionId: string;
  customerId: string;
  userId?: string;
  amountDue: number;
  total: number;
  tax: number;
  subtotal: number;
  currency: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible" | "finalized";
  invoicePdf: string | null;
  hostedInvoiceUrl: string | null;
  createdAt: Date;
  finalizedAt?: Date;
  paidAt?: Date;
  updatedAt?: Date;
}
