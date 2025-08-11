# Phase 3 Checkout Flow

This phase wires basic payment handling for the Mini App.

1. **Plans** – The mini app calls the `/plans` Edge function to list available subscription plans.
2. **Checkout** – Users choose a plan and start checkout via the `/checkout-init` function, which creates a pending payment and returns method instructions.
3. **Upload** – The client requests a signed URL from `/receipt-upload-url` and uploads the receipt directly to the private `receipts` storage bucket.
4. **Submit** – After uploading, the client calls `/receipt-submit` to link the file to the payment and mark it for review.
5. **Admin approval** – A later phase will handle verifying receipts and activating plans.

Receipts are stored in a private Supabase Storage bucket and are only uploaded through signed URLs. All sensitive operations (payment creation, signed uploads, linking receipts) happen on Edge functions using the service role key.
