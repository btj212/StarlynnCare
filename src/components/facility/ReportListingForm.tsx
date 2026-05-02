"use client";

import { useState } from "react";

interface ReportListingFormProps {
  facilityId: string;
  facilityName: string;
}

export function ReportListingForm({ facilityId, facilityName }: ReportListingFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/listing-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facilityId,
          reason: reason.trim(),
          contactEmail: email.trim() || null,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setReason("");
        setEmail("");
        setTimeout(() => {
          setIsOpen(false);
          setSubmitted(false);
        }, 3000);
      } else {
        console.error("Failed to submit report");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="text-green-800 font-medium">Thank you for your feedback</div>
        <div className="text-green-700 text-sm mt-1">
          Your report has been submitted and will be reviewed by our team.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-gray-200 pt-8">
      <details 
        className="group"
        open={isOpen}
        onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 font-medium">
          Is this listing wrong? Report an issue →
        </summary>
        
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                What's incorrect about this listing?
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Please describe what information is incorrect or outdated..."
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email (optional)
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="your@email.com (if you'd like a response)"
              />
            </div>
            
            <div className="text-xs text-gray-500">
              Reports help us maintain accurate facility information. 
              Your report will be reviewed within 1-2 business days.
            </div>
            
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !reason.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </details>
    </div>
  );
}