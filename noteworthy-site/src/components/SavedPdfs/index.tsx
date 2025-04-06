"use client";
import React, { useState, useEffect } from "react";
import { Download, Trash, FileX, FileStack, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import ManageSubscription from "../Subscription/ManageSubscription";

interface SavedPdf {
  id: string;
  title: string;
  createdAt: string;
  processType: string;
}

// Function to check if a user has premium status
const checkPremiumStatus = async () => {
  try {
    const response = await fetch('/api/user/subscription-status');
    if (!response.ok) {
      throw new Error('Failed to fetch subscription status');
    }
    const data = await response.json();
    return data.isPremium;
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
};

const SavedPdfs = () => {
  const { data: session } = useSession();
  const [pdfs, setPdfs] = useState<SavedPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPdfs, setSelectedPdfs] = useState<string[]>([]);
  const [showCombineDialog, setShowCombineDialog] = useState(false);
  const [combineTitle, setCombineTitle] = useState("");
  const [combining, setCombining] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredPdfs, setFilteredPdfs] = useState<SavedPdf[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // Fetch the saved PDFs when the component mounts
  useEffect(() => {
    const fetchPdfs = async () => {
      try {
        const response = await fetch("/api/pdf/list");
        if (!response.ok) {
          throw new Error("Failed to fetch PDFs");
        }
        
        const data = await response.json();
        setPdfs(data);
        setFilteredPdfs(data);
      } catch (error) {
        console.error("Error fetching PDFs:", error);
        setError("Failed to load your saved PDFs. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPdfs();
  }, []);
  
  // Check subscription status when session is available
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!session?.user?.id) {
        setIsPremium(false);
        setSubscriptionLoading(false);
        return;
      }
      
      try {
        const premium = await checkPremiumStatus();
        setIsPremium(premium);
      } catch (error) {
        console.error('Error checking premium status:', error);
      } finally {
        setSubscriptionLoading(false);
      }
    };
    
    fetchSubscriptionStatus();
  }, [session]);

  // Filter PDFs based on search term
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredPdfs(pdfs);
    } else {
      const filtered = pdfs.filter((pdf) =>
        pdf.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPdfs(filtered);
    }
  }, [searchTerm, pdfs]);

  const handleDownload = (id: string) => {
    window.open(`/api/pdf/get/${id}?download=true`, "_blank");
  };

  const handleCombinePdfs = async () => {
    if (selectedPdfs.length < 2) {
      toast.error("Please select at least 2 PDFs to combine");
      return;
    }

    if (!combineTitle.trim()) {
      toast.error("Please enter a title for the combined PDF");
      return;
    }

    setCombining(true);

    try {
      const response = await fetch("/api/pdf/combine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdfIds: selectedPdfs,
          title: combineTitle,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to combine PDFs");
      }

      // If the response is a PDF, open it in a new tab
      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("application/pdf")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      }

      // Refresh the PDFs list
      const listResponse = await fetch("/api/pdf/list");
      if (listResponse.ok) {
        const data = await listResponse.json();
        setPdfs(data);
        setFilteredPdfs(data);
      }

      toast.success("PDFs combined successfully!");
      // Reset the selection
      setSelectedPdfs([]);
      setShowCombineDialog(false);
      setCombineTitle("");
    } catch (error) {
      console.error("Error combining PDFs:", error);
      toast.error("Failed to combine PDFs. Please try again.");
    } finally {
      setCombining(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Use custom confirmation instead of built-in confirm
    const userConfirmed = window.confirm("Are you sure you want to delete this PDF?");
    if (!userConfirmed) {
      return;
    }

    try {
      // This would require an additional API endpoint to delete a PDF
      const response = await fetch(`/api/pdf/delete/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete PDF");
      }

      // Filter out the deleted PDF
      setPdfs(pdfs.filter((pdf) => pdf.id !== id));
      setFilteredPdfs(filteredPdfs.filter((pdf) => pdf.id !== id));
      toast.success("PDF deleted successfully");
    } catch (error) {
      console.error("Error deleting PDF:", error);
      toast.error("Failed to delete PDF. Please try again.");
    }
  };

  const togglePdfSelection = (id: string) => {
    if (selectedPdfs.includes(id)) {
      setSelectedPdfs(selectedPdfs.filter((pdfId) => pdfId !== id));
    } else {
      setSelectedPdfs([...selectedPdfs, id]);
    }
  };

  return (
    <section className="relative py-20 md:py-[120px]">
      <div className="absolute left-0 top-0 -z-[1] h-full w-full dark:bg-dark"></div>
      <div className="absolute left-0 top-0 -z-[1] h-1/2 w-full bg-[#E9F9FF] dark:bg-dark-700 lg:h-[45%] xl:h-1/2"></div>
      <div className="container px-4">
        <div className="mb-12 text-center">
          <span className="mb-2 block text-base font-medium text-primary">
            YOUR SAVED DOCUMENTS
          </span>
          <h2 className="text-[32px] font-bold leading-tight text-dark dark:text-white sm:text-[40px] md:text-[44px]">
            Saved PDFs
          </h2>
          <p className="mx-auto mt-4 max-w-[600px] text-base text-body-color dark:text-dark-6">
            View, download, and combine your saved PDF documents.
          </p>
          
          {/* Subscription Status & Management */}
          {!subscriptionLoading && (
            <div className="mt-6">
              <ManageSubscription isPremium={isPremium} />
            </div>
          )}
        </div>

        <div className="wow fadeInUp rounded-lg bg-white p-8 shadow-testimonial dark:bg-dark-2 dark:shadow-none">
          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileX className="h-16 w-16 text-red-500 mb-4" />
              <p className="text-center text-lg text-body-color dark:text-dark-6">
                {error}
              </p>
            </div>
          ) : pdfs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileX className="h-16 w-16 text-primary mb-4" />
              <p className="text-center text-lg text-body-color dark:text-dark-6">
                You dont have any saved PDFs yet. Start by converting your
                handwritten notes and saving them.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search PDFs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full min-w-[300px] rounded-md border border-[#f1f1f1] bg-transparent pl-10 pr-4 py-2 text-body-color focus:outline-none focus:ring-2 focus:ring-primary dark:border-dark-3 dark:text-dark-6"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-body-color dark:text-dark-6" />
                  {searchTerm && (
                    <button
                      className="absolute right-3 top-2.5"
                      onClick={() => setSearchTerm("")}
                    >
                      <X className="h-5 w-5 text-body-color dark:text-dark-6" />
                    </button>
                  )}
                </div>

                {selectedPdfs.length > 1 && (
                  <button
                    className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-base font-medium text-white transition duration-300 ease-in-out hover:bg-primary/90"
                    onClick={() => setShowCombineDialog(true)}
                  >
                    <FileStack className="mr-2 h-5 w-5" />
                    Combine Selected ({selectedPdfs.length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className={`rounded-lg border p-4 transition-all ${
                      selectedPdfs.includes(pdf.id)
                        ? "border-primary bg-primary/5"
                        : "border-[#f1f1f1] dark:border-dark-3 hover:border-primary/50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`select-${pdf.id}`}
                          checked={selectedPdfs.includes(pdf.id)}
                          onChange={() => togglePdfSelection(pdf.id)}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <h3
                          className="cursor-pointer text-lg font-medium text-dark dark:text-white"
                          onClick={() => handleDownload(pdf.id)}
                        >
                          {pdf.title}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          className="text-gray-500 hover:text-primary"
                          onClick={() => handleDownload(pdf.id)}
                          title="Download"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                        <button
                          className="text-gray-500 hover:text-red-500"
                          onClick={() => handleDelete(pdf.id)}
                          title="Delete"
                        >
                          <Trash className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-body-color dark:text-dark-6">
                      <span>
                        {new Date(pdf.createdAt).toLocaleDateString()} at{" "}
                        {new Date(pdf.createdAt).toLocaleTimeString()}
                      </span>
                      <span className="capitalize">{pdf.processType}</span>
                    </div>

                    <div className="mt-4">
                      <iframe
                        src={`/api/pdf/preview/${pdf.id}`}
                        className="h-32 w-full rounded border border-[#f1f1f1] dark:border-dark-3"
                        title={pdf.title}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Combine PDFs Dialog */}
          {showCombineDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-dark-2">
                <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
                  Combine PDFs
                </h3>
                <p className="mb-4 text-body-color dark:text-dark-6">
                  You are about to combine {selectedPdfs.length} PDFs. Please
                  enter a title for the combined document.
                </p>
                <div className="mb-4">
                  <label
                    htmlFor="combine-title"
                    className="mb-2 block text-sm font-medium text-dark dark:text-white"
                  >
                    Title for combined PDF
                  </label>
                  <input
                    id="combine-title"
                    type="text"
                    value={combineTitle}
                    onChange={(e) => setCombineTitle(e.target.value)}
                    className="w-full rounded-md border border-[#f1f1f1] bg-transparent px-4 py-2 text-body-color focus:outline-none focus:ring-2 focus:ring-primary dark:border-dark-3 dark:text-dark-6"
                    placeholder="e.g., Combined Notes - Chapter 1-3"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-primary bg-transparent px-4 py-2 text-sm font-medium text-primary transition duration-300 ease-in-out hover:bg-primary/10"
                    onClick={() => {
                      setShowCombineDialog(false);
                      setCombineTitle("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition duration-300 ease-in-out ${
                      !combineTitle.trim() || combining
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:bg-primary/90"
                    }`}
                    onClick={handleCombinePdfs}
                    disabled={!combineTitle.trim() || combining}
                  >
                    {combining ? (
                      <>
                        <svg
                          className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Combining...
                      </>
                    ) : (
                      "Combine"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SavedPdfs;
