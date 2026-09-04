"use client";

import { useState } from "react";

type Analysis = {
  issue_type: string;
  confidence: number;
  severity: string;
  description: string;
};

export default function ReportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const img = e.target.files?.[0];
    if (!img) return;

    setFile(img);
    setPreview(URL.createObjectURL(img));
    setResult(null);
  };

  const analyze = async () => {
    if (!file) return;

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/complaints/analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      setResult(data.analysis);
    } catch {
      alert("Cannot connect to backend");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">Report a Civic Issue</h1>
        <p className="mt-2 text-slate-400">
          Upload an image and let CivicFix AI analyze it.
        </p>

        <label className="mt-8 flex h-72 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900">
          <input
            type="file"
            accept="image/*"
            onChange={handleSelect}
            className="hidden"
          />

          {preview ? (
            <img
              src={preview}
              alt="preview"
              className="h-full w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="text-center">
              <p className="text-5xl">📷</p>
              <p className="mt-3 text-slate-300">Click to upload</p>
            </div>
          )}
        </label>

        <button
          onClick={analyze}
          disabled={!file || loading}
          className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-semibold disabled:bg-slate-700"
        >
          {loading ? "Analyzing..." : "Analyze with AI"}
        </button>

        {result && (
          <div className="mt-8 rounded-2xl bg-slate-900 p-6">
            <h2 className="mb-4 text-2xl font-bold">AI Result</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-slate-400">Issue</p>
                <p className="text-xl font-bold">{result.issue_type}</p>
              </div>

              <div>
                <p className="text-slate-400">Confidence</p>
                <p className="text-xl font-bold">{result.confidence}%</p>
              </div>

              <div>
                <p className="text-slate-400">Severity</p>
                <p className="text-xl font-bold">{result.severity}</p>
              </div>

              <div>
                <p className="text-slate-400">Description</p>
                <p>{result.description}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}